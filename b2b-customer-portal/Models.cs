using System;
using System.ComponentModel.DataAnnotations;

namespace B2BCustomerPortal.Models
{
    public class BusinessPartner
    {
        [Key]
        public string CardCode { get; set; } = string.Empty;
        public string CardName { get; set; } = string.Empty;
        public int PriceListId { get; set; }
        public decimal CreditLimit { get; set; }
        public decimal CurrentBalance { get; set; }
        public string PasswordHash { get; set; } = string.Empty; // Simple authentication placeholder
    }

    public class Item
    {
        [Key]
        public string ItemCode { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public decimal BasePrice { get; set; }
        public double StockLevel { get; set; }
    }

    public class Invoice
    {
        [Key]
        public string InvoiceNum { get; set; } = string.Empty; // e.g. INV-1001
        public string CardCode { get; set; } = string.Empty;
        public DateTime DocDate { get; set; }
        public DateTime DocDueDate { get; set; }
        public decimal DocTotal { get; set; }
        public string Status { get; set; } = "Unpaid"; // Unpaid, Paid
        public string? PaymentTxHash { get; set; }
    }

    public class Order
    {
        [Key]
        public string OrderNum { get; set; } = string.Empty; // e.g. ORD-5001
        public string CardCode { get; set; } = string.Empty;
        public DateTime DocDate { get; set; }
        public decimal DocTotal { get; set; }
        public string SyncStatus { get; set; } = "Pending"; // Pending, Synced, Failed
        public string? SapDocEntry { get; set; } // SAP B1 assigned ID once synced
        public string ItemsJson { get; set; } = string.Empty; // Stores JSON list of ordered items in the queue
    }

    public class SyncLog
    {
        public int Id { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string AgentName { get; set; } = string.Empty; // AuthAgent, CatalogAgent, etc.
        public string Status { get; set; } = "Info"; // Info, Success, Warning, Error
        public string Message { get; set; } = string.Empty;
    }
}
