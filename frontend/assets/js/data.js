/* Mock seed data for FinanceHub Aggregation App (no network calls, no real bank data) */
(function () {
  window.FH = window.FH || {};

  var BANKS = [
    { id: "gtbank", name: "GTBank", short: "GTB" },
    { id: "access", name: "Access Bank", short: "ACC" },
    { id: "zenith", name: "Zenith Bank", short: "ZEN" },
    { id: "kuda", name: "Kuda MFB", short: "KUD" },
    { id: "uba", name: "UBA", short: "UBA" },
    { id: "opay", name: "OPay Wallet", short: "OPY" }
  ];

  var SEED_ACCOUNTS = [
    {
      id: "acc_gtb_001",
      bankId: "gtbank",
      nickname: "GTBank Salary Account",
      type: "Current Account",
      last4: "4821",
      currency: "NGN",
      balance: 842350.75,
      health: "good"
    },
    {
      id: "acc_kuda_001",
      bankId: "kuda",
      nickname: "Kuda Savings",
      type: "Savings Account",
      last4: "0093",
      currency: "NGN",
      balance: 1250900.0,
      health: "good"
    },
    {
      id: "acc_access_001",
      bankId: "access",
      nickname: "Access Business",
      type: "Current Account",
      last4: "7710",
      currency: "NGN",
      balance: 96420.5,
      health: "attention"
    },
    {
      id: "acc_opay_001",
      bankId: "opay",
      nickname: "OPay Wallet",
      type: "Wallet",
      last4: "2205",
      currency: "NGN",
      balance: 18230.0,
      health: "good"
    }
  ];

  var CATEGORIES = [
    { id: "housing", name: "Housing & Rent", color: "#6c8bff" },
    { id: "food", name: "Food & Groceries", color: "#38d9c9" },
    { id: "transport", name: "Transport", color: "#f5b942" },
    { id: "utilities", name: "Utilities", color: "#ff6b6b" },
    { id: "entertainment", name: "Entertainment", color: "#c084fc" },
    { id: "savings", name: "Savings & Investment", color: "#46d19a" },
    { id: "other", name: "Other", color: "#9aa3c7" }
  ];

  function generateTransactions() {
    var merchants = [
      { name: "Shoprite Lekki", category: "food" },
      { name: "Ikeja Electric", category: "utilities" },
      { name: "Uber Trip", category: "transport" },
      { name: "Netflix Subscription", category: "entertainment" },
      { name: "Rent - Landlord Payment", category: "housing" },
      { name: "PiggyVest Auto-save", category: "savings" },
      { name: "Jumia Checkout", category: "other" },
      { name: "Bolt Ride", category: "transport" },
      { name: "MTN Data Bundle", category: "utilities" },
      { name: "Local Market", category: "food" },
      { name: "Cinema Outing", category: "entertainment" },
      { name: "Stanbic Mutual Fund", category: "savings" }
    ];
    var transactions = [];
    var today = new Date();
    for (var i = 0; i < 42; i++) {
      var merchant = merchants[i % merchants.length];
      var account = SEED_ACCOUNTS[i % SEED_ACCOUNTS.length];
      var daysAgo = Math.floor(i * 1.6);
      var date = new Date(today);
      date.setDate(date.getDate() - daysAgo);
      var isCredit = merchant.category === "savings" ? false : i % 11 === 0;
      var amount = isCredit
        ? Math.round((15000 + Math.random() * 60000) * 100) / 100
        : Math.round((800 + Math.random() * 45000) * 100) / 100;
      transactions.push({
        id: "txn_" + (1000 + i),
        accountId: account.id,
        date: date.toISOString(),
        description: merchant.name,
        category: merchant.category,
        amount: isCredit ? amount : -amount,
        status: i % 17 === 0 ? "pending" : "posted"
      });
    }
    return transactions.sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
  }

  var SEED_TRANSACTIONS = generateTransactions();

  var SEED_BENEFICIARIES = [
    { id: "ben_001", name: "Chidinma Okafor", bankName: "Access Bank", accountNumber: "0123456789" },
    { id: "ben_002", name: "Tunde Balogun", bankName: "Zenith Bank", accountNumber: "0098765432" },
    { id: "ben_003", name: "IKEDC Prepaid Meter", bankName: "Biller", accountNumber: "45102938201" },
    { id: "ben_004", name: "Emeka Nwosu", bankName: "Kuda MFB", accountNumber: "2003117744" }
  ];

  var SEED_TRANSFERS = [
    {
      id: "trf_001",
      beneficiaryId: "ben_001",
      accountId: "acc_gtb_001",
      amount: 45000,
      note: "Rent contribution",
      status: "completed",
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      id: "trf_002",
      beneficiaryId: "ben_003",
      accountId: "acc_kuda_001",
      amount: 12500,
      note: "Electricity bill",
      status: "completed",
      createdAt: new Date(Date.now() - 6 * 86400000).toISOString()
    }
  ];

  var SEED_DISPUTES = [
    {
      id: "dsp_001",
      transactionId: "txn_1000",
      reason: "Charged twice for the same transaction",
      status: "in-review",
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      updates: [
        { date: new Date(Date.now() - 2 * 86400000).toISOString(), note: "Dispute submitted to FinanceHub support." },
        { date: new Date(Date.now() - 1 * 86400000).toISOString(), note: "Forwarded to GTBank dispute desk for review." }
      ]
    }
  ];

  window.FH.data = {
    BANKS: BANKS,
    SEED_ACCOUNTS: SEED_ACCOUNTS,
    CATEGORIES: CATEGORIES,
    SEED_TRANSACTIONS: SEED_TRANSACTIONS,
    SEED_DISPUTES: SEED_DISPUTES,
    SEED_BENEFICIARIES: SEED_BENEFICIARIES,
    SEED_TRANSFERS: SEED_TRANSFERS
  };
})();
