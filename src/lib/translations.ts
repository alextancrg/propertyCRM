// ---------------------------------------------------------------------------
// Central translation dictionary.
//
// English ("en") is the source of truth and the default language. Malay
// ("ms") and Simplified Chinese ("zh-CN") patches are deep-merged over the
// English dictionary at module load, so any key you leave untranslated falls
// back to English automatically (no missing-key crashes).
//
// `translate(dict, key, vars)` is a pure function — safe to call from both
// client components and server components (see src/lib/i18n.tsx and
// src/lib/i18n-server.ts).
// ---------------------------------------------------------------------------

export type Locale = "en" | "ms" | "zh-CN";

export const LOCALE_COOKIE = "assethub_locale";

export const SUPPORTED_LOCALES: { value: Locale; label: string; native: string }[] = [
  { value: "en", label: "English", native: "English" },
  { value: "ms", label: "Bahasa Malaysia", native: "Bahasa Melayu" },
  { value: "zh-CN", label: "Simplified Chinese", native: "简体中文" },
];

const en = {
  common: {
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    running: "Running…",
    enabled: "Enabled",
    disabled: "Disabled",
    add: "Add",
    unlimited: "Unlimited",
    somethingWentWrong: "Something went wrong.",
  },
  roles: {
    Administrator: "Administrator",
    "Property Manager": "Property Manager",
    System: "System",
  },
  app: {
    brand: "AssetHub",
    tagline: "Intelligent Portfolio Manager",
    notSignedIn: "Not signed in",
    signOut: "Sign out",
    privacyPolicy: "Privacy Policy",
  },
  language: {
    label: "Language",
    switchTo: "Switch language",
  },
  nav: {
    dashboard: "Dashboard",
    managers: "Profiles",
    owners: "Owners",
    properties: "Properties & Leases",
    bills: "Bills & Utilities",
    rentals: "Rental Collection",
    tax: "Tax & Audit",
    documents: "Documents",
    subscription: "Subscription",
    ai: "WhatsApp AI Agent",
    support: "Support",
  },
  titles: {
    dashboard: "Portfolio Overview",
    managers: "Profiles",
    owners: "Owners & Landlords",
    properties: "Properties & Leases",
    bills: "Bills & Utility Payments",
    rentals: "Rental Collection",
    tax: "Tax & Compliance Audit",
    documents: "Document Vault",
    subscription: "Subscription & Billing",
    ai: "WhatsApp AI Agent",
    support: "Support & Feedback",
  },
  header: {
    agentChecking: "Agent…",
    agentLive: "AI Agent Live",
    agentOff: "AI Agent Off",
    agentTitle: "WhatsApp AI agent status — click to configure",
    notifications: "Notifications",
  },
  login: {
    subtitle: "Property Manager Sign In",
    email: "Email address",
    password: "Password",
    signIn: "Sign In",
    signingIn: "Signing in…",
    failed: "Login failed.",
    couldNotLogin: "Could not log in.",
    registerHint: "New here? Register a property manager under the Profiles section after signing in.",
  },
  dashboard: {
    totalProperties: "Total Properties",
    occupancyRate: "Occupancy Rate",
    rentArrears: "Rent Arrears",
    openUtilityBills: "Open Utility Bills",
    snapshot: "Portfolio Financial Snapshot",
    viewTaxStatements: "View tax statements →",
    monthlyRentRoll: "Monthly Rent Roll",
    collectedYtd: "Collected (YTD)",
    expensesYtd: "Expenses (YTD)",
    netPosition:
      "Net rental position: {amount} — expenses are verified against receipts in the document vault for LHDN compliance.",
    recentActivity: "Recent Activity & AI Actions",
    noActivity: "No activity recorded yet.",
    byUser: " · by {name}",
    waTitle: "AI Agent Actions (WhatsApp)",
    waSubtitle:
      "What the WhatsApp AI agent tried on your tenants, and when — repeated actions show every execution time.",
    waSentUnlimited: "WhatsApp messages sent this month: {used} (unlimited)",
    waLeft: "WhatsApp messages left: {left} of {limit}",
    waEmpty: "No AI agent actions yet. Configure your authorized tenants under WhatsApp AI Agent and run the reminder engine.",
    noOutstandingRent: "No outstanding rent. 🎉",
    waAction: {
      rentReminder: "Rent reminder",
      selfAlert: "Self escalation",
      chatReply: "Chat reply",
      maintenance: "Maintenance",
      viewing: "Viewing",
      autoRemoved: "Auto-removed (lease expired)",
    },
    waStatus: {
      sent: "Sent",
      quotaReached: "Quota reached",
      twilioNotConfigured: "Twilio not configured",
      failed: "Failed",
      info: "Info",
    },
  },
  ai: {
    heroTitle: "WhatsApp AI Agent",
    heroDesc:
      "Communicates with your authorized tenants — rent reminders, maintenance triage, and viewing scheduling — over WhatsApp via Twilio.",
    enabled: "Enabled",
    disabled: "Disabled",
    twilioConnected: "Twilio connected",
    twilioNotConfigured: "Twilio not configured",
    disableAgent: "Disable agent",
    enableAgent: "Enable agent",
    unlimitedMessages: "Unlimited WhatsApp messages",
    messagesLeft: "{left} of {limit} WhatsApp messages left this month",
    sentNoLimit: "{used} sent · no plan limit",
    usedPlan: "{used} used · {planName} plan",
    quotaExhausted: "Monthly quota reached — upgrade your plan for more messages",
    prunedNotice:
      "{count} tenant(s) whose lease expired over a week ago were removed from the authorized list, and you've been notified.",
    configuration: "Configuration",
    saved: "Saved",
    modelLocked: "The AI model is pre-configured for your account and is not editable.",
    autonomyLevel: "Autonomy level",
    semiOption: "Semi-autonomous (human-in-the-loop)",
    fullOption: "Fully autonomous",
    fullDesc: "The agent handles the full conversation with the tenant and takes actions itself.",
    semiDesc: "The agent chats with the tenant but defers decisions and escalations to the property manager.",
    greeting: "Greeting message",
    greetingPlaceholder: "Hi, this is the property management office…",
    systemPrompt: "System prompt",
    escalationEmail: "Escalation email",
    escalationHint: "Escalations are sent to your registered account email ({email}) and cannot be changed here.",
    automationBehaviours: "Automation behaviours",
    autoRentReminder: "Auto rent reminder",
    autoRentReminderDesc: "Nudge tenants with overdue rent.",
    autoMaintenanceTriage: "Auto maintenance triage",
    autoMaintenanceTriageDesc: "Classify and log maintenance requests.",
    autoViewingSchedule: "Auto viewing scheduling",
    autoViewingScheduleDesc: "Propose viewing slots for vacant units.",
    saveConfig: "Save configuration",
    saving: "Saving…",
    authorizedTenants: "Authorized Tenants",
    authorizedTenantsDesc:
      "These are the only tenants the AI agent will contact. Eligible tenants are those with an active lease on a unit you manage. Tenants whose lease expired over a week ago are removed automatically.",
    noMoreEligible: "No more eligible tenants",
    selectTenantToAdd: "Select a tenant to add…",
    add: "Add",
    noAuthorizedYet: "No tenants authorized yet. Add tenants from the dropdown above.",
    removeFromAuthorized: "Remove from authorized list",
    authorizedUpdated: "Authorized tenants updated.",
    assistantName: "AssetHub Assistant",
    online: "online — replying automatically",
    offline: "offline — agent disabled",
    clearConversation: "Clear conversation",
    chatEmpty: "Start a test conversation. Try “my rent is overdue” or “there is a water leak”.",
    typeMessage: "Type a tenant message…",
    agentDisabledPlaceholder: "Agent is disabled — test messages are recorded only",
    chatError: "Sorry, something went wrong. Please try again.",
    reminderEngine: "Rent Reminder Engine",
    reminderEngineDesc:
      "Based on each property's rent due date, the agent reminds the tenant 3 days before, 1 day after and 3 days after the due date. Once the reminders are exhausted and the rent is still unpaid, a self-WhatsApp alert (red highlighted) is raised with the unit name and the tenant's phone number. Only your authorized tenants are contacted, and every message counts against your plan's monthly WhatsApp quota.",
    runReminders: "Run reminders now",
    running: "Running…",
    runResult: "Dispatched {reminders} reminder(s) · escalated {escalated} · skipped {skipped}.",
    runFailed: "Could not run the reminder engine.",
    noRemindersYet:
      "No reminders sent yet. Run the engine now, or schedule it to hit POST /api/whatsapp/reminders daily (e.g. Vercel Cron).",
    selfWhatsappBadge: "SELF WHATSAPP",
    tenantPhone: "Tenant phone: {phone}",
  },
};

export type Dictionary = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const msPatch: DeepPartial<Dictionary> = {
  common: {
    save: "Simpan",
    saving: "Menyimpan…",
    saved: "Disimpan",
    running: "Sedang berjalan…",
    enabled: "Aktif",
    disabled: "Tidak aktif",
    add: "Tambah",
    unlimited: "Tanpa had",
    somethingWentWrong: "Berlaku ralat.",
  },
  roles: {
    Administrator: "Pentadbir",
    "Property Manager": "Pengurus Hartanah",
    System: "Sistem",
  },
  app: {
    tagline: "Pengurus Portfolio Pintar",
    notSignedIn: "Belum log masuk",
    signOut: "Log keluar",
    privacyPolicy: "Dasar Privasi",
  },
  language: {
    label: "Bahasa",
    switchTo: "Tukar bahasa",
  },
  nav: {
    dashboard: "Papan Pemuka",
    managers: "Profil",
    owners: "Pemilik",
    properties: "Hartanah & Sewaan",
    bills: "Bil & Utiliti",
    rentals: "Kutipan Sewa",
    tax: "Cukai & Audit",
    documents: "Dokumen",
    subscription: "Langganan",
    ai: "Ejen AI WhatsApp",
    support: "Sokongan",
  },
  titles: {
    dashboard: "Gambaran Portfolio",
    managers: "Profil",
    owners: "Pemilik & Tuan Tanah",
    properties: "Hartanah & Sewaan",
    bills: "Bil & Pembayaran Utiliti",
    rentals: "Kutipan Sewa",
    tax: "Cukai & Audit Pematuhan",
    documents: "Rak Dokumen",
    subscription: "Langganan & Pengebilan",
    ai: "Ejen AI WhatsApp",
    support: "Sokongan & Maklum Balas",
  },
  header: {
    agentChecking: "Ejen…",
    agentLive: "Ejen AI Aktif",
    agentOff: "Ejen AI Tidak Aktif",
    agentTitle: "Status ejen AI WhatsApp — klik untuk konfigurasi",
    notifications: "Pemberitahuan",
  },
  login: {
    subtitle: "Log Masuk Pengurus Hartanah",
    email: "Alamat e-mel",
    password: "Kata laluan",
    signIn: "Log Masuk",
    signingIn: "Sedang log masuk…",
    failed: "Log masuk gagal.",
    couldNotLogin: "Tidak dapat log masuk.",
    registerHint: "Baru di sini? Daftar pengurus hartanah di bahagian Profil selepas log masuk.",
  },
  dashboard: {
    totalProperties: "Jumlah Hartanah",
    occupancyRate: "Kadar Penghunian",
    rentArrears: "Tunggakan Sewa",
    openUtilityBills: "Bil Utiliti Belum Bayar",
    snapshot: "Gambaran Kewangan Portfolio",
    viewTaxStatements: "Lihat penyata cukai →",
    monthlyRentRoll: "Jumlah Sewa Bulanan",
    collectedYtd: "Dikumpul (YTD)",
    expensesYtd: "Perbelanjaan (YTD)",
    netPosition:
      "Kedudukan sewa bersih: {amount} — perbelanjaan disahkan terhadap resit dalam rak dokumen untuk pematuhan LHDN.",
    recentActivity: "Aktiviti Terkini & Tindakan AI",
    noActivity: "Belum ada aktiviti direkodkan.",
    byUser: " · oleh {name}",
    waTitle: "Tindakan Ejen AI (WhatsApp)",
    waSubtitle:
      "Apa yang ejen AI WhatsApp cuba pada penyewa anda, dan bila — tindakan berulang menunjukkan setiap masa pelaksanaan.",
    waSentUnlimited: "Mesej WhatsApp dihantar bulan ini: {used} (tanpa had)",
    waLeft: "Mesej WhatsApp tinggal: {left} daripada {limit}",
    waEmpty:
      "Belum ada tindakan ejen AI. Konfigurasikan penyewa yang dibenarkan di bawah Ejen AI WhatsApp dan jalankan enjin peringatan.",
    noOutstandingRent: "Tiada tunggakan sewa. 🎉",
    waAction: {
      rentReminder: "Peringatan sewa",
      selfAlert: "Eskalasi kendiri",
      chatReply: "Balasan sembang",
      maintenance: "Penyelenggaraan",
      viewing: "Lawatan",
      autoRemoved: "Auto-dibuang (sewaan tamat)",
    },
    waStatus: {
      sent: "Dihantar",
      quotaReached: "Kuota dicapai",
      twilioNotConfigured: "Twilio tidak dikonfigurasi",
      failed: "Gagal",
      info: "Maklumat",
    },
  },
  ai: {
    heroTitle: "Ejen AI WhatsApp",
    heroDesc:
      "Berkomunikasi dengan penyewa yang anda benarkan — peringatan sewa, triaj penyelenggaraan, dan penjadualan lawatan — melalui WhatsApp via Twilio.",
    enabled: "Aktif",
    disabled: "Tidak aktif",
    twilioConnected: "Twilio disambung",
    twilioNotConfigured: "Twilio tidak dikonfigurasi",
    disableAgent: "Lumpuhkan ejen",
    enableAgent: "Aktifkan ejen",
    unlimitedMessages: "Mesej WhatsApp tanpa had",
    messagesLeft: "{left} daripada {limit} mesej WhatsApp tinggal bulan ini",
    sentNoLimit: "{used} dihantar · tiada had pelan",
    usedPlan: "{used} digunakan · pelan {planName}",
    quotaExhausted: "Kuota bulanan dicapai — naik taraf pelan anda untuk lebih banyak mesej",
    prunedNotice:
      "{count} penyewa yang sewaannya tamat lebih seminggu lalu telah dikeluarkan daripada senarai dibenarkan dan anda telah dimaklumkan.",
    configuration: "Konfigurasi",
    saved: "Disimpan",
    modelLocked: "Model AI telah dikonfigurasikan untuk akaun anda dan tidak boleh disunting.",
    autonomyLevel: "Tahap autonomi",
    semiOption: "Separa autonomi (manusia dalam gelung)",
    fullOption: "Autonomi sepenuhnya",
    fullDesc: "Ejen mengendalikan perbualan penuh dengan penyewa dan mengambil tindakan sendiri.",
    semiDesc: "Ejen bersembang dengan penyewa tetapi merujuk keputusan dan eskalasi kepada pengurus hartanah.",
    greeting: "Mesej ucapan",
    greetingPlaceholder: "Hai, ini pejabat pengurusan hartanah…",
    systemPrompt: "Arahan sistem",
    escalationEmail: "E-mel eskalasi",
    escalationHint: "Eskalasi dihantar ke e-mel akaun berdaftar anda ({email}) dan tidak boleh diubah di sini.",
    automationBehaviours: "Tingkah laku automasi",
    autoRentReminder: "Peringatan sewa auto",
    autoRentReminderDesc: "Ingatkan penyewa tentang sewa tertunggak.",
    autoMaintenanceTriage: "Triaj penyelenggaraan auto",
    autoMaintenanceTriageDesc: "Klasifikasikan dan catat permintaan penyelenggaraan.",
    autoViewingSchedule: "Penjadualan lawatan auto",
    autoViewingScheduleDesc: "Cadangkan slot lawatan untuk unit kosong.",
    saveConfig: "Simpan konfigurasi",
    saving: "Menyimpan…",
    authorizedTenants: "Penyewa Dibenarkan",
    authorizedTenantsDesc:
      "Ini satu-satunya penyewa yang akan dihubungi oleh ejen AI. Penyewa yang layak ialah mereka yang mempunyai sewaan aktif pada unit yang anda uruskan. Penyewa yang sewaannya tamat lebih seminggu lalu dikeluarkan secara automatik.",
    noMoreEligible: "Tiada lagi penyewa layak",
    selectTenantToAdd: "Pilih penyewa untuk ditambah…",
    add: "Tambah",
    noAuthorizedYet: "Belum ada penyewa dibenarkan. Tambah penyewa daripada menu lungsur di atas.",
    removeFromAuthorized: "Keluarkan daripada senarai dibenarkan",
    authorizedUpdated: "Penyewa dibenarkan dikemas kini.",
    assistantName: "Pembantu AssetHub",
    online: "dalam talian — membalas secara automatik",
    offline: "luar talian — ejen dilumpuhkan",
    clearConversation: "Kosongkan perbualan",
    chatEmpty: "Mulakan perbualan ujian. Cuba “sewa saya tertunggak” atau “ada kebocoran air”.",
    typeMessage: "Taip mesej penyewa…",
    agentDisabledPlaceholder: "Ejen dilumpuhkan — mesej ujian hanya direkodkan",
    chatError: "Maaf, berlaku ralat. Sila cuba lagi.",
    reminderEngine: "Enjin Peringatan Sewa",
    reminderEngineDesc:
      "Berdasarkan tarikh akhir sewa setiap hartanah, ejen mengingatkan penyewa 3 hari sebelum, 1 hari selepas dan 3 hari selepas tarikh akhir. Apabila peringatan habis dan sewa masih belum dibayar, amaran WhatsApp kendiri (diserlahkan merah) dinaikkan dengan nama unit dan nombor telefon penyewa. Hanya penyewa yang anda benarkan dihubungi, dan setiap mesej dikira terhadap kuota WhatsApp bulanan pelan anda.",
    runReminders: "Jalankan peringatan sekarang",
    running: "Sedang berjalan…",
    runResult: "Menghantar {reminders} peringatan · eskalasi {escalated} · dilangkau {skipped}.",
    runFailed: "Tidak dapat menjalankan enjin peringatan.",
    noRemindersYet:
      "Belum ada peringatan dihantar. Jalankan enjin sekarang, atau jadualkan POST /api/whatsapp/reminders setiap hari (cth. Vercel Cron).",
    selfWhatsappBadge: "WHATSAPP KENDIRI",
    tenantPhone: "Telefon penyewa: {phone}",
  },
};

const zhPatch: DeepPartial<Dictionary> = {
  common: {
    save: "保存",
    saving: "保存中…",
    saved: "已保存",
    running: "运行中…",
    enabled: "已启用",
    disabled: "已停用",
    add: "添加",
    unlimited: "无限",
    somethingWentWrong: "出错了。",
  },
  roles: {
    Administrator: "管理员",
    "Property Manager": "物业经理",
    System: "系统",
  },
  app: {
    tagline: "智能投资组合管理",
    notSignedIn: "未登录",
    signOut: "退出登录",
    privacyPolicy: "隐私政策",
  },
  language: {
    label: "语言",
    switchTo: "切换语言",
  },
  nav: {
    dashboard: "仪表盘",
    managers: "账户",
    owners: "业主",
    properties: "房产与租约",
    bills: "账单与公用事业",
    rentals: "租金收取",
    tax: "税务与审计",
    documents: "文档",
    subscription: "订阅",
    ai: "WhatsApp AI 助手",
    support: "支持",
  },
  titles: {
    dashboard: "投资组合概览",
    managers: "账户",
    owners: "业主与房东",
    properties: "房产与租约",
    bills: "账单与公用事业付款",
    rentals: "租金收取",
    tax: "税务与合规审计",
    documents: "文档库",
    subscription: "订阅与计费",
    ai: "WhatsApp AI 助手",
    support: "支持与反馈",
  },
  header: {
    agentChecking: "助手…",
    agentLive: "AI 助手在线",
    agentOff: "AI 助手离线",
    agentTitle: "WhatsApp AI 助手状态 — 点击配置",
    notifications: "通知",
  },
  login: {
    subtitle: "物业经理登录",
    email: "电子邮件地址",
    password: "密码",
    signIn: "登录",
    signingIn: "登录中…",
    failed: "登录失败。",
    couldNotLogin: "无法登录。",
    registerHint: "新用户？登录后请在“账户”部分注册物业经理。",
  },
  dashboard: {
    totalProperties: "房产总数",
    occupancyRate: "入住率",
    rentArrears: "租金拖欠",
    openUtilityBills: "未付公用事业账单",
    snapshot: "投资组合财务概览",
    viewTaxStatements: "查看税务报表 →",
    monthlyRentRoll: "每月租金总额",
    collectedYtd: "已收取（年初至今）",
    expensesYtd: "支出（年初至今）",
    netPosition:
      "净租金状况：{amount} — 支出已根据文档库中的收据进行核验，以确保符合 LHDN 规定。",
    recentActivity: "最近活动与 AI 操作",
    noActivity: "暂无活动记录。",
    byUser: " · 由 {name}",
    waTitle: "AI 助手操作（WhatsApp）",
    waSubtitle: "WhatsApp AI 助手对您的租客尝试了什么操作以及时间 — 重复操作会显示每次执行时间。",
    waSentUnlimited: "本月已发送的 WhatsApp 消息：{used}（无限）",
    waLeft: "剩余 WhatsApp 消息：{left} / {limit}",
    waEmpty: "暂无 AI 助手操作。请在“WhatsApp AI 助手”下配置授权租客并运行提醒引擎。",
    noOutstandingRent: "无未付租金。🎉",
    waAction: {
      rentReminder: "租金提醒",
      selfAlert: "自我升级",
      chatReply: "聊天回复",
      maintenance: "维护",
      viewing: "看房",
      autoRemoved: "自动移除（租约到期）",
    },
    waStatus: {
      sent: "已发送",
      quotaReached: "配额已达",
      twilioNotConfigured: "Twilio 未配置",
      failed: "失败",
      info: "信息",
    },
  },
  ai: {
    heroTitle: "WhatsApp AI 助手",
    heroDesc: "与您授权的租客沟通 — 租金提醒、维护分类和看房安排 — 通过 Twilio 的 WhatsApp 进行。",
    enabled: "已启用",
    disabled: "已停用",
    twilioConnected: "Twilio 已连接",
    twilioNotConfigured: "Twilio 未配置",
    disableAgent: "停用助手",
    enableAgent: "启用助手",
    unlimitedMessages: "无限 WhatsApp 消息",
    messagesLeft: "本月剩余 WhatsApp 消息：{left} / {limit}",
    sentNoLimit: "已发送 {used} · 无计划限制",
    usedPlan: "已使用 {used} · {planName} 计划",
    quotaExhausted: "已达到本月配额 — 升级计划以获得更多消息",
    prunedNotice: "有 {count} 名租客的租约已过期超过一周，已从授权列表中移除，并已通知您。",
    configuration: "配置",
    saved: "已保存",
    modelLocked: "AI 模型已为您的账户预配置，不可编辑。",
    autonomyLevel: "自主级别",
    semiOption: "半自主（人机协作）",
    fullOption: "完全自主",
    fullDesc: "助手与租客进行完整对话并自行采取行动。",
    semiDesc: "助手与租客聊天，但将决定和升级事项交由物业经理处理。",
    greeting: "问候语",
    greetingPlaceholder: "您好，这里是物业管理办公室…",
    systemPrompt: "系统提示词",
    escalationEmail: "升级电子邮件",
    escalationHint: "升级事项将发送到您注册的账户邮箱（{email}），此处不可更改。",
    automationBehaviours: "自动化行为",
    autoRentReminder: "自动租金提醒",
    autoRentReminderDesc: "提醒有逾期租金的租客。",
    autoMaintenanceTriage: "自动维护分类",
    autoMaintenanceTriageDesc: "对维护请求进行分类和记录。",
    autoViewingSchedule: "自动看房安排",
    autoViewingScheduleDesc: "为闲置单元建议看房时间。",
    saveConfig: "保存配置",
    saving: "保存中…",
    authorizedTenants: "授权租客",
    authorizedTenantsDesc:
      "这些是 AI 助手将联系的唯一租客。符合条件的租客是指您管理的单元上有有效租约的租客。租约已过期超过一周的租客会自动移除。",
    noMoreEligible: "没有更多符合条件的租客",
    selectTenantToAdd: "选择要添加的租客…",
    add: "添加",
    noAuthorizedYet: "尚未授权任何租客。请从上面的下拉菜单中选择要添加的租客。",
    removeFromAuthorized: "从授权列表中移除",
    authorizedUpdated: "授权租客已更新。",
    assistantName: "AssetHub 助手",
    online: "在线 — 自动回复",
    offline: "离线 — 助手已停用",
    clearConversation: "清空对话",
    chatEmpty: "开始测试对话。试试“我的租金已逾期”或“有水管漏水”。",
    typeMessage: "输入租客消息…",
    agentDisabledPlaceholder: "助手已停用 — 测试消息仅作记录",
    chatError: "抱歉，出错了。请重试。",
    reminderEngine: "租金提醒引擎",
    reminderEngineDesc:
      "根据每处房产的租金到期日，助手会在到期日前 3 天、到期日后 1 天和 3 天提醒租客。当提醒用尽且租金仍未支付时，会发出自我 WhatsApp 警报（红色突出显示），并附上单元名称和租客电话号码。仅会联系您授权的租客，每条消息都会计入您计划的每月 WhatsApp 配额。",
    runReminders: "立即运行提醒",
    running: "运行中…",
    runResult: "已发送 {reminders} 条提醒 · 升级 {escalated} · 跳过 {skipped}。",
    runFailed: "无法运行提醒引擎。",
    noRemindersYet: "尚未发送提醒。立即运行引擎，或安排每天调用 POST /api/whatsapp/reminders（例如 Vercel Cron）。",
    selfWhatsappBadge: "自我 WhatsApp",
    tenantPhone: "租客电话：{phone}",
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch ?? base) as T;
  }
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    const b = (base as Record<string, unknown>)[key];
    const p = (patch as Record<string, unknown>)[key];
    out[key] = isPlainObject(b) && isPlainObject(p) ? deepMerge(b, p) : p;
  }
  return out as T;
}

export const translations: Record<Locale, Dictionary> = {
  en,
  ms: deepMerge(en, msPatch),
  "zh-CN": deepMerge(en, zhPatch),
};

/** Look up a dotted key (e.g. "dashboard.waLeft") in a dictionary and interpolate {vars}. */
export function translate(
  dict: Dictionary,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, dict);
  let out = typeof value === "string" ? value : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return out;
}

/** Translate against a specific locale's merged dictionary. */
export function translateLocale(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  return translate(translations[locale], key, vars);
}
