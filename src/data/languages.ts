import { SupportedLanguage } from "../types";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: "vi-VN",
    name: "Tiếng Việt",
    englishName: "Vietnamese",
    flag: "🇻🇳",
    recognitionCode: "vi-VN",
  },
  {
    code: "en-US",
    name: "English (US)",
    englishName: "English (US)",
    flag: "🇺🇸",
    recognitionCode: "en-US",
  },
  {
    code: "en-GB",
    name: "English (UK)",
    englishName: "English (UK)",
    flag: "🇬🇧",
    recognitionCode: "en-GB",
  },
  {
    code: "ja-JP",
    name: "日本語",
    englishName: "Japanese",
    flag: "🇯🇵",
    recognitionCode: "ja-JP",
  },
  {
    code: "ko-KR",
    name: "한국어",
    englishName: "Korean",
    flag: "🇰🇷",
    recognitionCode: "ko-KR",
  },
  {
    code: "zh-CN",
    name: "中文 (普通话)",
    englishName: "Chinese (Simplified)",
    flag: "🇨🇳",
    recognitionCode: "zh-CN",
  },
  {
    code: "fr-FR",
    name: "Français",
    englishName: "French",
    flag: "🇫🇷",
    recognitionCode: "fr-FR",
  },
  {
    code: "es-ES",
    name: "Español",
    englishName: "Spanish",
    flag: "🇪🇸",
    recognitionCode: "es-ES",
  },
  {
    code: "de-DE",
    name: "Deutsch",
    englishName: "German",
    flag: "🇩🇪",
    recognitionCode: "de-DE",
  },
  {
    code: "it-IT",
    name: "Italiano",
    englishName: "Italian",
    flag: "🇮🇹",
    recognitionCode: "it-IT",
  },
  {
    code: "ru-RU",
    name: "Русский",
    englishName: "Russian",
    flag: "🇷🇺",
    recognitionCode: "ru-RU",
  },
  {
    code: "pt-BR",
    name: "Português",
    englishName: "Portuguese",
    flag: "🇧🇷",
    recognitionCode: "pt-BR",
  },
  {
    code: "id-ID",
    name: "Bahasa Indonesia",
    englishName: "Indonesian",
    flag: "🇮🇩",
    recognitionCode: "id-ID",
  },
  {
    code: "th-TH",
    name: "ไทย",
    englishName: "Thai",
    flag: "🇹🇭",
    recognitionCode: "th-TH",
  },
  {
    code: "hi-IN",
    name: "हिन्दी",
    englishName: "Hindi",
    flag: "🇮🇳",
    recognitionCode: "hi-IN",
  },
];

export interface SampleRecording {
  id: string;
  title: string;
  language: string;
  category: string;
  duration: string;
  text: string;
}

export const SAMPLE_RECORDINGS: SampleRecording[] = [
  {
    id: "sample-vn-meeting",
    title: "Cuộc họp Chiến lược Quý 3 & Ra mắt Sản phẩm",
    language: "vi-VN",
    category: "Họp doanh nghiệp",
    duration: "1:45",
    text: `Chào mọi người, hôm nay chúng ta họp tổng kết tiến độ quý 3 và thống nhất kế hoạch ra mắt nền tảng thương mại điện tử mới.
Đầu tiên về mặt kỹ thuật, đội ngũ phát triển đã hoàn thành 95% các tính năng cốt lõi, bao gồm cổng thanh toán bảo mật, tìm kiếm sản phẩm thông minh và luồng xử lý đơn hàng. Tốc độ tải trang đạt 1,2 giây trên mạng di động.
Tuy nhiên, có hai điểm nghẽn cần tháo gỡ gấp: hệ thống đồng bộ kho vận bên thứ ba vẫn còn độ trễ khoảng 5 phút trong giờ cao điểm, và giao diện mobile cần tối ưu lại luồng thanh toán một bước.
Về kế hoạch triển khai: Anh Hoàng sẽ phụ trách làm việc với đối tác logistics trước thứ Năm tuần này để nâng cấp API. Chị Lan chuẩn bị toàn bộ tài liệu đào tạo cho đội ngũ chăm sóc khách hàng trước ngày 15. Tuần tới chúng ta sẽ mở đợt Beta Testing nội bộ với 200 nhân viên trước khi công bố rộng rãi ra thị trường vào đầu tháng sau.`,
  },
  {
    id: "sample-en-pitch",
    title: "AI Product Architecture & Investor Pitch",
    language: "en-US",
    category: "Thuyết trình & Pitching",
    duration: "1:20",
    text: `Good morning everyone. Today I'm thrilled to present our multimodal voice-to-text intelligence platform.
Traditional transcription tools only convert audio into unstructured walls of text. Professionals spend hours manually reading transcripts to extract action items, deadlines, and key takeaways.
Our solution bridges this gap. By coupling streaming audio capture with Gemini's reasoning architecture, we instantly generate executive briefings, prioritized task lists, and multi-lingual summaries in seconds.
Over the past quarter, we achieved a 42% week-over-week increase in active users, with average daily engagement exceeding 28 minutes per user. Next quarter, our core focus will be rolling out native enterprise CRM integrations and expanding our offline-first edge capabilities.`,
  },
  {
    id: "sample-vn-medical",
    title: "Tư vấn Sức khỏe & Chế độ Dinh dưỡng Lành mạnh",
    language: "vi-VN",
    category: "Y tế & Đời sống",
    duration: "1:10",
    text: `Trong buổi chia sẻ hôm nay, bác sĩ muốn lưu ý với các bạn về ba nguyên tắc vàng để duy trì sức khỏe tim mạch và kiểm soát năng lượng mỗi ngày.
Thứ nhất, hãy đảm bảo uống đủ từ 1,8 đến 2,2 lít nước lọc mỗi ngày, chia đều vào các khung giờ buổi sáng và buổi chiều thay vì uống dồn vào ban đêm.
Thứ hai, hạn chế tối đa các loại đồ uống có ga và thực phẩm chế biến sẵn chứa lượng đường fructose cao. Thay vào đó, tăng cường rau xanh có màu đậm và ngũ cốc nguyên hạt.
Thứ ba, duy trì ít nhất 30 phút vận động thể chất vừa phải như đi bộ nhanh, bơi lội hoặc đạp xe mỗi ngày. Nếu có dấu hiệu khó thở hoặc chóng mặt khi thay đổi tư thế đột ngột, bạn cần đi khám chuyên khoa tim mạch sớm để được đo điện tâm đồ và siêu âm kiểm tra chi tiết.`,
  },
];
