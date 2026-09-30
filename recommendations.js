export const ACCOUNT_OPTIONS = [
  "出張経費",
  "事業外費用",
  "旅費交通費",
  "通信費",
  "普通預金",
  "事務用品",
  "水道光熱費",
  "接待交際費",
  "事業主貸",
  "受取報酬の源泉徴収税",
  "専従者給与",
  "医療費",
  "諸会費",
  "新聞図書費",
  "租税公課",
  "車両費",
  "当座預金"
];

export const COUNTERPARTY_OPTIONS = [
  "コンビニ", "Amazon.co.jp", "鉄道", "宿泊", "ガソリン", "コストコ", "太平洋クラブ",
  "レンタカー", "Google Cloud", "OpenAI", "スシロー", "ETC", "ガス　幕張", "三津子",
  "水道　管理費　幕張", "生活費", "電気　幕張", "Yahoo Japan", "ドコモ", "税金", "サントリー",
  "駐車場", "富里ひよし館", "ブリヂストン", "NHK", "電話", "Bebe", "大竹歯科", "N-Nose",
  "ユニクロ", "利府ゴルフクラブ", "東急リゾート勝浦", "千恵子　振込", "バス", "富士フィルム",
  "幕張診療所", "iHerb", "JALカード", "JINS", "有料道路", "郵便局", "品川幕張", "NewYorker",
  "radiko", "食事", "yahoo Shop", "寿司ヤマト", "社友会", "Zurich", "アウトレット",
  "まかいの牧場", "ホンダ幕張", "夕食", "ナイキ", "ウェブポ", "スイッチサイエンス",
  "ザロイヤルゴルフ"
];

export const RECOMMENDATION_RULES = [
  {
    keywords: ["宿泊", "ホテル", "アパサービス", "アパホテル"],
    account: "出張経費",
    counterparty: "宿泊",
    evidence: "過去データでは取引先「宿泊」35件中32件が「出張経費」です。"
  },
  {
    keywords: ["鉄道", "新幹線"],
    account: "旅費交通費",
    counterparty: "鉄道",
    evidence: "過去データでは取引先「鉄道」59件中58件が「旅費交通費」です。"
  },
  {
    keywords: ["バス"],
    account: "旅費交通費",
    counterparty: "バス",
    evidence: "過去データでは取引先「バス」2件が「旅費交通費」です。"
  },
  {
    keywords: ["amazon.co.jp", "amazon"],
    account: "事業外費用",
    counterparty: "Amazon.co.jp",
    evidence: "過去データではAmazon.co.jp 78件中55件が「事業外費用」です。"
  },
  {
    keywords: ["ガソリン", "給油"],
    account: "旅費交通費",
    counterparty: "ガソリン",
    evidence: "過去データでは取引先「ガソリン」22件が「旅費交通費」です。"
  },
  {
    keywords: ["レンタカー"],
    account: "旅費交通費",
    counterparty: "レンタカー",
    evidence: "過去データでは取引先「レンタカー」16件が「旅費交通費」です。"
  },
  {
    keywords: ["etc"],
    account: "旅費交通費",
    counterparty: "ETC",
    evidence: "過去データでは取引先「ETC」10件が「旅費交通費」です。"
  },
  {
    keywords: ["駐車"],
    account: "旅費交通費",
    counterparty: "駐車場",
    evidence: "過去データでは取引先「駐車場」5件が「旅費交通費」です。"
  },
  {
    keywords: ["有料道路"],
    account: "旅費交通費",
    counterparty: "有料道路",
    evidence: "過去データでは取引先「有料道路」1件が「旅費交通費」です。"
  }
];
