# Chrome Web Store Listing - BromptCard

## Name (45 chars max)
BromptCard - Image to Prompt

## Short summary (132 chars max)
EN: Turn images into clean Vietnamese + English prompts using your own Gemini tab, only on the sites you enable.
VI: Biến ảnh thành prompt Việt + Anh bằng chính tab Gemini của bạn, chỉ trên các website bạn bật.

## Category
Productivity

## Language
Vietnamese (primary), English

---

## Detailed description (EN)

BromptCard turns images on selected websites into clean, structured prompts you can paste straight into an image generator.

It does this through your own logged-in Gemini tab, so there is no API key, no account, and no hosted server. You stay in control of your own Gemini usage.

HOW IT WORKS
1. Open Gemini in another tab and sign in.
2. Open the BromptCard popup.
3. Enable the websites where you want BromptCard to work. `pinterest.com` is enabled by default.
4. On an enabled site, right-click an image or hover it.
5. Click Faithful or Style.
6. BromptCard sends the image to your Gemini tab in the background and reads the structured reply.

SITE CONTROL
- BromptCard does not stay active on every page.
- Users can paste a full URL or just a domain into the popup.
- Subdomains are covered automatically.
- Outside the enabled-site list, the floating buttons and panel stay quiet.

TWO MODES
- Faithful: reconstructs the image into a faithful, reproduction-ready prompt in Vietnamese and English. Always free.
- Style: extracts the transferable visual style (medium, shape language, lighting logic, palette, finish) plus a ready-to-use [SUBJECT] transfer prompt and negative prompt.

FEATURES
- Vietnamese + English output side by side.
- Enabled-site allowlist managed in the popup.
- Floating panel you can drag, resize, and minimize to a quick-access orb.
- Local history with thumbnails - nothing leaves your device except what goes to your own Gemini tab.
- Screenshot crop for canvas or protected images.
- One-click copy.

PRICING
- Faithful is always free and unlimited.
- Style and future modes share 10 free uses per day.
- Pro unlocks unlimited use.

PRIVACY
BromptCard does not run a backend and does not collect your data. The only external destination is Google Gemini, through the tab you already opened. See the privacy policy for details.

Note: BromptCard automates a Gemini web tab you are signed into, for personal use. Gemini quality and availability are controlled by Google.

---

## Detailed description (VI)

BromptCard biến ảnh trên các website bạn chọn thành prompt gọn gàng, có cấu trúc, để dán thẳng vào công cụ tạo ảnh.

Tiện ích làm điều này thông qua chính tab Gemini bạn đã đăng nhập, nên không cần API key, không tài khoản, không máy chủ. Bạn tự chủ hạn mức Gemini của mình.

CÁCH DÙNG
1. Mở Gemini ở một tab khác và đăng nhập.
2. Mở popup của BromptCard.
3. Bật các website bạn muốn dùng. `pinterest.com` được bật mặc định.
4. Trên một site đã bật, chuột phải vào ảnh hoặc di chuột lên ảnh.
5. Bấm Faithful hoặc Style.
6. BromptCard gửi ảnh vào tab Gemini ở chế độ nền và đọc kết quả có cấu trúc.

KIỂM SOÁT WEBSITE
- BromptCard không hoạt động ồn ào trên mọi trang nữa.
- Người dùng có thể dán full URL hoặc chỉ domain vào popup.
- Subdomain được áp dụng tự động.
- Ngoài danh sách website được bật, nút nổi và panel sẽ giữ im lặng.

HAI CHẾ ĐỘ
- Faithful: tái tạo ảnh thành prompt trung thực, sẵn sàng tái dựng, bằng tiếng Việt và tiếng Anh. Luôn miễn phí.
- Style: trích xuất phong cách thị giác có thể chuyển giao (chất liệu, ngôn ngữ hình khối, logic ánh sáng, bảng màu, độ hoàn thiện) kèm prompt chuyển phong cách dạng [SUBJECT] và negative prompt.

TÍNH NĂNG
- Kết quả tiếng Việt + tiếng Anh song song.
- Danh sách website được bật nằm ngay trong popup.
- Panel nổi có thể kéo, đổi kích thước, thu nhỏ thành orb truy cập nhanh.
- Lịch sử cục bộ kèm hình thu nhỏ - không gì rời khỏi thiết bị ngoài dữ liệu bạn gửi vào tab Gemini của chính bạn.
- Cắt ảnh màn hình cho ảnh canvas hoặc ảnh được bảo vệ.
- Sao chép một chạm.

GIÁ
- Faithful luôn miễn phí, không giới hạn.
- Style và các chế độ tương lai dùng chung 10 lượt miễn phí mỗi ngày.
- Pro mở khóa không giới hạn.

QUYỀN RIÊNG TƯ
BromptCard không chạy backend và không thu thập dữ liệu. Điểm đến bên ngoài duy nhất là Google Gemini, thông qua tab bạn đã mở. Xem chính sách quyền riêng tư để biết chi tiết.

Lưu ý: BromptCard tự động hóa tab web Gemini mà bạn đã đăng nhập, phục vụ mục đích cá nhân. Chất lượng và khả dụng của Gemini do Google kiểm soát.

---

## Permission justifications (for review)

- `contextMenus`: add the right-click action on images on sites the user enabled.
- `activeTab` + `scripting`: inject the in-page panel and drive the Gemini tab to deliver the image and read the reply.
- `tabs`: find or open the user's Gemini tab in the background and inspect the active tab for enabled-site checks.
- `storage`: save settings, enabled-site list, and local history on the device.
- `host_permissions` (`http`/`https`): the extension can work on the sites the user chooses to enable; `gemini.google.com` access is required to deliver the image to the user's Gemini session.
- Single purpose: turn an image the user selects into a text prompt.

## Keywords / tags
image to prompt, reverse prompt, gemini, prompt generator, ai art prompt, style transfer, midjourney prompt, stable diffusion prompt
