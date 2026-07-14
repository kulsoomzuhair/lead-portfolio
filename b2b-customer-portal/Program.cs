using Microsoft.EntityFrameworkCore;
using B2BCustomerPortal.Data;
using B2BCustomerPortal.Models;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Configure SQLite Database Context
builder.Services.AddDbContext<PortalDbContext>(options =>
    options.UseSqlite("Data Source=portal.db"));

// Enable CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddHttpClient();

var app = builder.Build();

app.UseCors("AllowAll");
app.UseDefaultFiles();
app.UseStaticFiles(); // Serves index.html, style.css, app.js from wwwroot

// Auto-create/migrate SQLite database on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    db.Database.EnsureCreated();
    
    // Clear sync logs on startup
    db.SyncLogs.RemoveRange(db.SyncLogs);
    db.SaveChanges();
    
    db.SyncLogs.Add(new SyncLog { AgentName = "System", Status = "Success", Message = "Local Portal SQLite database initialized and seeded." });
    db.SaveChanges();
}

/* =========================================================================
   1. B2B PORTAL CUSTOMER API ENDPOINTS
   ========================================================================= */

// POST /api/login
app.MapPost("/api/login", async (LoginRequest req, PortalDbContext db) =>
{
    db.SyncLogs.Add(new SyncLog { AgentName = "AuthAgent", Status = "Info", Message = $"Auth request received for CardCode: {req.CardCode}" });
    await db.SaveChangesAsync();

    var bp = await db.BusinessPartners.FirstOrDefaultAsync(b => b.CardCode == req.CardCode);
    if (bp == null || bp.PasswordHash != req.Password)
    {
        db.SyncLogs.Add(new SyncLog { AgentName = "AuthAgent", Status = "Error", Message = $"Invalid login attempt for CardCode: {req.CardCode}" });
        await db.SaveChangesAsync();
        return Results.Json(new { success = false, message = "Invalid Client Code or password." }, statusCode: 401);
    }

    db.SyncLogs.Add(new SyncLog { AgentName = "AuthAgent", Status = "Success", Message = $"Authentication successful. Mapped to BP: '{bp.CardName}'" });
    await db.SaveChangesAsync();

    return Results.Ok(new { success = true, cardCode = bp.CardCode, cardName = bp.CardName, balance = bp.CurrentBalance, limit = bp.CreditLimit });
});

// GET /api/catalog/{cardCode}
app.MapGet("/api/catalog/{cardCode}", async (string cardCode, PortalDbContext db) =>
{
    db.SyncLogs.Add(new SyncLog { AgentName = "CatalogAgent", Status = "Info", Message = $"Fetching catalog and pricing contract for CardCode: {cardCode}" });
    await db.SaveChangesAsync();

    var bp = await db.BusinessPartners.FirstOrDefaultAsync(b => b.CardCode == cardCode);
    if (bp == null)
    {
        return Results.NotFound(new { message = "Customer not found." });
    }

    var items = await db.Items.ToListAsync();
    
    // Apply B2B pricing contract based on PriceListId (List 1 = 10% off, List 2 = 25% off)
    decimal discountMultiplier = bp.PriceListId == 1 ? 0.90m : 0.75m;

    var catalog = items.Select(item => new
    {
        item.ItemCode,
        item.ItemName,
        BasePrice = item.BasePrice,
        ContractPrice = Math.Round(item.BasePrice * discountMultiplier, 2),
        item.StockLevel
    });

    db.SyncLogs.Add(new SyncLog { AgentName = "CatalogAgent", Status = "Success", Message = $"Catalog pricing generated using SAP Price List ID: {bp.PriceListId} ({Math.Round((1-discountMultiplier)*100)}% Discount Applied)." });
    await db.SaveChangesAsync();

    return Results.Ok(catalog);
});

// GET /api/invoices/{cardCode}
app.MapGet("/api/invoices/{cardCode}", async (string cardCode, PortalDbContext db) =>
{
    var invoices = await db.Invoices.Where(i => i.CardCode == cardCode).ToListAsync();
    return Results.Ok(invoices);
});

// POST /api/orders/checkout
app.MapPost("/api/orders/checkout", async (CheckoutRequest req, PortalDbContext db, HttpClient http) =>
{
    db.SyncLogs.Add(new SyncLog { AgentName = "OrderAgent", Status = "Info", Message = $"New order request submitted for CardCode: {req.CardCode}. Order Total: ${req.TotalAmount}" });
    await db.SaveChangesAsync();

    // 1. Credit Limit Check
    var bp = await db.BusinessPartners.FirstOrDefaultAsync(b => b.CardCode == req.CardCode);
    if (bp == null) return Results.NotFound(new { message = "BP not found" });

    if (bp.CurrentBalance + req.TotalAmount > bp.CreditLimit)
    {
        db.SyncLogs.Add(new SyncLog { AgentName = "OrderAgent", Status = "Error", Message = $"Transaction Blocked: Order exceeds credit limit. Bal: ${bp.CurrentBalance}, Limit: ${bp.CreditLimit}" });
        await db.SaveChangesAsync();
        return Results.BadRequest(new { message = "Credit limit exceeded. Order rejected." });
    }

    // 2. Queue local order
    var orderNum = "ORD-" + new Random().Next(1000, 9999);
    var order = new Order
    {
        OrderNum = orderNum,
        CardCode = req.CardCode,
        DocDate = DateTime.Now,
        DocTotal = req.TotalAmount,
        SyncStatus = "Pending",
        ItemsJson = JsonSerializer.Serialize(req.Items)
    };

    db.Orders.Add(order);
    db.SyncLogs.Add(new SyncLog { AgentName = "OrderAgent", Status = "Info", Message = $"Order saved to local failover queue as: {orderNum}. Processing synchronization..." });
    await db.SaveChangesAsync();

    // 3. Sync to mock SAP B1 Service Layer
    try
    {
        // Target endpoint: http://localhost:5000/b1s/v1/Orders
        var requestUrl = "http://localhost:5000/b1s/v1/Orders";
        var response = await http.PostAsJsonAsync(requestUrl, new
        {
            CardCode = req.CardCode,
            DocDueDate = DateTime.Now.AddDays(7).ToString("yyyy-MM-dd"),
            DocumentLines = req.Items.Select(i => new { i.ItemCode, i.Quantity, i.UnitPrice })
        });

        if (response.IsSuccessStatusCode)
        {
            var sapResponse = await response.Content.ReadFromJsonAsync<SapDocResponse>();
            
            order.SyncStatus = "Synced";
            order.SapDocEntry = sapResponse?.DocEntry.ToString();
            
            // Adjust customer balance locally
            bp.CurrentBalance += req.TotalAmount;
            
            db.SyncLogs.Add(new SyncLog { AgentName = "OrderAgent", Status = "Success", Message = $"SAP B1 Sync Successful. Created Sales Order ID: {sapResponse?.DocEntry} in SAP database." });
            await db.SaveChangesAsync();

            return Results.Ok(new { success = true, orderNum, sapDocEntry = sapResponse?.DocEntry });
        }
        else
        {
            order.SyncStatus = "Failed";
            db.SyncLogs.Add(new SyncLog { AgentName = "OrderAgent", Status = "Error", Message = "Service Layer Sync Failed: Server returned status code error." });
            await db.SaveChangesAsync();
            return Results.Json(new { success = false, message = "SAP B1 Sync failed, order held in local queue." }, statusCode: 502);
        }
    }
    catch (Exception ex)
    {
        order.SyncStatus = "Failed";
        db.SyncLogs.Add(new SyncLog { AgentName = "OrderAgent", Status = "Error", Message = $"Service Layer Connection Error: {ex.Message}. Transaction is cached in local queue." });
        await db.SaveChangesAsync();
        return Results.Json(new { success = false, message = "Integration Offline. Order cached locally." }, statusCode: 503);
    }
});

// POST /api/invoices/pay
app.MapPost("/api/invoices/pay", async (PayInvoiceRequest req, PortalDbContext db, HttpClient http) =>
{
    db.SyncLogs.Add(new SyncLog { AgentName = "BillingAgent", Status = "Info", Message = $"Invoice Payment request received for Invoice: {req.InvoiceNum}. Processing Stripe transaction..." });
    await db.SaveChangesAsync();

    var invoice = await db.Invoices.FirstOrDefaultAsync(i => i.InvoiceNum == req.InvoiceNum);
    if (invoice == null) return Results.NotFound(new { message = "Invoice not found" });

    // Simulate Payment processor approval
    var txHash = "ch_" + Guid.NewGuid().ToString("N").Substring(0, 16);
    db.SyncLogs.Add(new SyncLog { AgentName = "BillingAgent", Status = "Info", Message = $"Stripe authorized. Transaction Hash: {txHash}. Posting Incoming Payment to SAP B1..." });
    await db.SaveChangesAsync();

    // Sync to mock SAP B1 Service Layer (Create Incoming Payment)
    try
    {
        var requestUrl = "http://localhost:5000/b1s/v1/IncomingPayments";
        var response = await http.PostAsJsonAsync(requestUrl, new
        {
            CardCode = invoice.CardCode,
            PaymentSum = invoice.DocTotal,
            TransferReference = txHash,
            InvoiceNum = invoice.InvoiceNum
        });

        if (response.IsSuccessStatusCode)
        {
            var sapResponse = await response.Content.ReadFromJsonAsync<SapDocResponse>();
            
            invoice.Status = "Paid";
            invoice.PaymentTxHash = txHash;

            // Reduce customer balance
            var bp = await db.BusinessPartners.FirstOrDefaultAsync(b => b.CardCode == invoice.CardCode);
            if (bp != null) bp.CurrentBalance -= invoice.DocTotal;

            db.SyncLogs.Add(new SyncLog { AgentName = "BillingAgent", Status = "Success", Message = $"Incoming Payment ID: {sapResponse?.DocEntry} posted to SAP B1. Ledger Invoice {req.InvoiceNum} closed." });
            await db.SaveChangesAsync();

            return Results.Ok(new { success = true, txHash, sapDocEntry = sapResponse?.DocEntry });
        }
        else
        {
            db.SyncLogs.Add(new SyncLog { AgentName = "BillingAgent", Status = "Error", Message = "Ledger Sync Failed: SAP B1 rejected the Incoming Payment posting." });
            await db.SaveChangesAsync();
            return Results.BadRequest(new { message = "Payment processed but SAP B1 sync failed." });
        }
    }
    catch (Exception ex)
    {
        db.SyncLogs.Add(new SyncLog { AgentName = "BillingAgent", Status = "Error", Message = $"Service Layer Connection Error during payment post: {ex.Message}" });
        await db.SaveChangesAsync();
        return Results.Json(new { message = "SAP B1 connection down. Ledger reconciliation pending." }, statusCode: 503);
    }
});

// GET /api/sync-logs
app.MapGet("/api/sync-logs", async (PortalDbContext db) =>
{
    var logs = await db.SyncLogs.OrderByDescending(l => l.Timestamp).Take(20).ToListAsync();
    return Results.Ok(logs);
});

/* =========================================================================
   2. INTEGRATED MOCK SAP BUSINESS ONE SERVICE LAYER (API EMULATION)
   ========================================================================= */

// POST /b1s/v1/Orders (Simulated Sales Order creation)
app.MapPost("/b1s/v1/Orders", (SapOrderPayload payload) =>
{
    var docEntry = new Random().Next(20000, 30000);
    Console.WriteLine($"[MOCK SAP B1] Created Sales Order. DocEntry: {docEntry}, CardCode: {payload.CardCode}");
    return Results.Json(new { DocEntry = docEntry, CardCode = payload.CardCode }, statusCode: 201);
});

// POST /b1s/v1/IncomingPayments (Simulated Incoming Payment posting)
app.MapPost("/b1s/v1/IncomingPayments", (SapPaymentPayload payload) =>
{
    var docEntry = new Random().Next(40000, 50000);
    Console.WriteLine($"[MOCK SAP B1] Posted Incoming Payment. DocEntry: {docEntry}, Sum: {payload.PaymentSum}, Ref: {payload.TransferReference}");
    return Results.Json(new { DocEntry = docEntry }, statusCode: 201);
});

app.Run("http://localhost:5000");

/* =========================================================================
   3. HELPER REQUEST/PAYLOAD RECORDS
   ========================================================================= */

public record LoginRequest(string CardCode, string Password);
public record CheckoutRequest(string CardCode, decimal TotalAmount, List<CartItem> Items);
public record CartItem(string ItemCode, int Quantity, decimal UnitPrice);
public record PayInvoiceRequest(string InvoiceNum);
public record SapDocResponse(int DocEntry);

public record SapOrderPayload(string CardCode, string DocDueDate, List<SapOrderLine> DocumentLines);
public record SapOrderLine(string ItemCode, double Quantity, decimal UnitPrice);

public record SapPaymentPayload(string CardCode, decimal PaymentSum, string TransferReference, string InvoiceNum);
