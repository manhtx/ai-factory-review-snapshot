export type MvpCountryCode = "US" | "VN" | "CN" | "JP" | "DE" | "GB" | "KR" | "IN" | "EA" | "FR" | "BR" | "ID" | "MX";

export const MVP_COUNTRY_OPTIONS: MvpCountryCode[] = ["US", "VN", "CN", "JP", "DE", "GB", "KR", "IN", "EA", "FR", "BR", "ID", "MX"];

export const MVP_COUNTRY_META: Record<MvpCountryCode, { name: string; flag: string; currency: string; region: string; centralBank: string }> = {
  US: { name: "United States", flag: "🇺🇸", currency: "USD", region: "North America", centralBank: "Federal Reserve" },
  VN: { name: "Vietnam", flag: "🇻🇳", currency: "VND", region: "Southeast Asia", centralBank: "State Bank of Vietnam" },
  CN: { name: "China", flag: "🇨🇳", currency: "CNY", region: "East Asia", centralBank: "People's Bank of China" },
  JP: { name: "Japan", flag: "🇯🇵", currency: "JPY", region: "East Asia", centralBank: "Bank of Japan" },
  DE: { name: "Germany", flag: "🇩🇪", currency: "EUR", region: "Europe", centralBank: "European Central Bank" },
  GB: { name: "United Kingdom", flag: "🇬🇧", currency: "GBP", region: "Europe", centralBank: "Bank of England" },
  KR: { name: "South Korea", flag: "🇰🇷", currency: "KRW", region: "East Asia", centralBank: "Bank of Korea" },
  IN: { name: "India", flag: "🇮🇳", currency: "INR", region: "South Asia", centralBank: "Reserve Bank of India" },
  EA: { name: "Euro Area", flag: "🇪🇺", currency: "EUR", region: "Europe", centralBank: "European Central Bank" },
  FR: { name: "France", flag: "🇫🇷", currency: "EUR", region: "Europe", centralBank: "European Central Bank" },
  BR: { name: "Brazil", flag: "🇧🇷", currency: "BRL", region: "Latin America", centralBank: "Central Bank of Brazil" },
  ID: { name: "Indonesia", flag: "🇮🇩", currency: "IDR", region: "Southeast Asia", centralBank: "Bank Indonesia" },
  MX: { name: "Mexico", flag: "🇲🇽", currency: "MXN", region: "Latin America", centralBank: "Bank of Mexico" },
};

