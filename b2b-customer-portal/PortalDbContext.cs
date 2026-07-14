using Microsoft.EntityFrameworkCore;
using B2BCustomerPortal.Models;
using System;

namespace B2BCustomerPortal.Data
{
    public class PortalDbContext : DbContext
    {
        public PortalDbContext(DbContextOptions<PortalDbContext> options) : base(options) { }

        public DbSet<BusinessPartner> BusinessPartners => Set<BusinessPartner>();
        public DbSet<Item> Items => Set<Item>();
        public DbSet<Invoice> Invoices => Set<Invoice>();
        public DbSet<Order> Orders => Set<Order>();
        public DbSet<SyncLog> SyncLogs => Set<SyncLog>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Pre-seed Business Partners
            modelBuilder.Entity<BusinessPartner>().HasData(
                new BusinessPartner
                {
                    CardCode = "C20000",
                    CardName = "Hasan & Co.",
                    PriceListId = 1, // 10% discount list
                    CreditLimit = 5000m,
                    CurrentBalance = 1500m,
                    PasswordHash = "hasan123" // Simplified auth
                },
                new BusinessPartner
                {
                    CardCode = "C30000",
                    CardName = "Zuhair Group",
                    PriceListId = 2, // 25% discount list
                    CreditLimit = 10000m,
                    CurrentBalance = 800m,
                    PasswordHash = "zuhair123" // Simplified auth
                }
            );

            // Pre-seed Wholesale Catalog Items
            modelBuilder.Entity<Item>().HasData(
                new Item { ItemCode = "A0001", ItemName = "SAP B1 WooCommerce Adapter", BasePrice = 450.00m, StockLevel = 45 },
                new Item { ItemCode = "A0002", ItemName = "SAP B1 Shopify API Middleware", BasePrice = 650.00m, StockLevel = 22 },
                new Item { ItemCode = "A0003", ItemName = "Custom B2B Customer Portal Node", BasePrice = 850.00m, StockLevel = 12 },
                new Item { ItemCode = "A0004", ItemName = "Stripe Payment Reconciliation Module", BasePrice = 350.00m, StockLevel = 50 },
                new Item { ItemCode = "A0005", ItemName = "OpenAI GPT Support Agent Wrapper", BasePrice = 250.00m, StockLevel = 80 }
            );

            // Pre-seed A/R Invoices
            modelBuilder.Entity<Invoice>().HasData(
                new Invoice
                {
                    InvoiceNum = "INV-1001",
                    CardCode = "C20000",
                    DocDate = DateTime.Now.AddDays(-15),
                    DocDueDate = DateTime.Now.AddDays(15),
                    DocTotal = 1200.00m,
                    Status = "Unpaid"
                },
                new Invoice
                {
                    InvoiceNum = "INV-1002",
                    CardCode = "C20000",
                    DocDate = DateTime.Now.AddDays(-5),
                    DocDueDate = DateTime.Now.AddDays(25),
                    DocTotal = 300.00m,
                    Status = "Unpaid"
                },
                new Invoice
                {
                    InvoiceNum = "INV-1003",
                    CardCode = "C30000",
                    DocDate = DateTime.Now.AddDays(-10),
                    DocDueDate = DateTime.Now.AddDays(20),
                    DocTotal = 800.00m,
                    Status = "Unpaid"
                }
            );
        }
    }
}
