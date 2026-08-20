# Addon phụ đề đa nguồn cho Stremio

Addon Stremio gom phụ đề từ nhiều nguồn cùng lúc, **mặc định ưu tiên tiếng Việt**.
Không dùng thư viện ngoài — chỉ Node.js >= 18 (`fetch` và giải nén zip đều có sẵn), nên `npm install` không cần thiết.

## Nguồn phụ đề

| Nguồn | Cần API key | Ghi chú |
|---|---|---|
| **SubtitleCat** | không | Tìm theo từ khoá; mỗi bản có nhiều ngôn ngữ (phần lớn là dịch máy). Nguồn tiếng Việt mạnh nhất. |
| **OpenSubtitles** | không | Qua addon chính chủ `opensubtitles-v3.strem.io`. Khớp theo IMDb id, và theo **hash file** nếu Stremio gửi `videoHash` → khớp chính xác bản đang phát. |
| **Subf2m** | không | Bản kế thừa của Subscene, phụ đề do người dùng upload, tải về dạng `.zip`. |
| **OpenSubtitles API** | có | `api.opensubtitles.com` — kho lớn nhất, có tên release thật. Key miễn phí: https://www.opensubtitles.com/consumers |
| **SubDL** | có | `subdl.com`. Key miễn phí: https://subdl.com/panel/api |

Ba nguồn đầu bật sẵn. Nguồn cần key sẽ **tự động bị bỏ qua** nếu chưa nhập key, không gây lỗi.
Các nguồn chạy song song; nguồn nào chậm quá 20s thì bị bỏ, các nguồn còn lại vẫn trả kết quả.

## Chạy

```bash
node src/server.js
```

Mặc định lắng nghe cổng `7000`. Mở http://localhost:7000/configure để chọn ngôn ngữ, chọn nguồn và lấy link cài đặt.

Biến môi trường:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `7000` | Cổng HTTP |
| `HOST` | `0.0.0.0` | Địa chỉ bind |
| `PUBLIC_URL` | *(tự suy ra từ header)* | Domain công khai khi deploy sau reverse proxy / Vercel / Render |

## Cài vào Stremio

1. Mở `/configure`, chọn ngôn ngữ (Tiếng Việt đã được chọn sẵn) và các nguồn muốn bật.
2. Bấm **Cài vào Stremio** (mở `stremio://…`), hoặc **Sao chép** link `…/manifest.json` rồi dán vào Stremio → Addons → *Add addon*.

Cấu hình được nhúng thẳng vào URL dưới dạng JSON mã hoá base64url, nên một server phục vụ được nhiều người với cấu hình khác nhau. API key (nếu có) cũng nằm trong URL này — **đừng chia sẻ link cài đặt của bạn cho người khác** nếu đã nhập key.

## Đường dẫn

| Route | Mô tả |
|---|---|
| `GET /configure` · `GET /<config>/configure` | Trang cấu hình |
| `GET /<config>/manifest.json` | Manifest của addon |
| `GET /<config>/subtitles/:type/:id.json` | Stremio gọi để lấy danh sách phụ đề |
| `GET /<config>/sub/<token>.srt` · `.vtt` | Proxy tải file phụ đề, tự giải nén + chuyển sang UTF-8 |
| `GET /health` | Health check |

## Cách hoạt động

1. Stremio gửi `id` (vd `tt1375666`, `tt0903747:1:2`) kèm `extra.filename` nếu biết tên file.
2. Addon lấy tên chính thức + năm từ Cinemeta, rồi dựng các câu tìm kiếm **theo đúng thứ tự này**:
   tên chính thức + năm → tên chính thức → tên file cắt tới năm/tập → tên file đầy đủ.
   Tên file release luôn hỏi **sau cùng** vì nó đầy tag (`[Anime Time]`, `HEVC 10bit`…) khiến các trang tìm kiếm trả về hàng trăm kết quả trùng tag nhưng khác phim.
3. Mỗi kết quả được chấm điểm theo độ phủ token **tên phim** (không phải tên file). Phủ dưới 50% → **loại thẳng**.
   Hàm `fold()` gộp các khác biệt phiên âm (Tenka**s**u / Tenka**z**u, Crayon / Krayon) nên đổi cách viết vẫn khớp.
4. Các nguồn chạy song song, kết quả gộp lại, bỏ trùng theo `(nguồn, ref)` và theo `(ngôn ngữ, tên release)`.
5. Lọc lần cuối trước khi trả về Stremio:
   - bỏ mọi mục điểm 0 và mọi ngôn ngữ không nằm trong danh sách đã chọn;
   - với phim bộ + `strictEpisode`: mục nào ghi rõ số tập mà **sai tập** thì bỏ;
   - ngưỡng tương đối tính **riêng cho từng ngôn ngữ** — khi một ngôn ngữ đã có bản khớp chuẩn thì các bản yếu của chính nó bị loại, nhưng điểm cao của tiếng Anh không loại oan tiếng Việt.
6. Trả về link `/sub/<token>.srt` của chính addon. Token nhúng id nguồn, và **mỗi nguồn tự kiểm tra `ref` của nó** (chặn path traversal và SSRF sang host lạ) trước khi tải.

Cache trong bộ nhớ: tìm kiếm 1 giờ, trang chi tiết 3–6 giờ, file phụ đề 12 giờ, kèm gộp request trùng nhau (single-flight).

## Cấu hình

| Tuỳ chọn | Mặc định | Ý nghĩa |
|---|---|---|
| `langs` | `["vi"]` | Danh sách ngôn ngữ theo thứ tự ưu tiên (tối đa 12) |
| `sources` | `["subtitlecat","opensubtitles","subf2m"]` | Các nguồn bật |
| `limit` | `10` | Số phụ đề tối đa trả về |
| `scan` | `6` | Số kết quả mỗi nguồn sẽ mở để lấy link |
| `showRelease` | `false` | Hiện tên nguồn + bản release cạnh tên ngôn ngữ trong Stremio |
| `strictEpisode` | `true` | Với phim bộ, chỉ nhận phụ đề đúng tập (`SxxExx` / `1x02`) |
| `osApiKey` | `""` | API key OpenSubtitles (tuỳ chọn) |
| `subdlApiKey` | `""` | API key SubDL (tuỳ chọn) |

## Kiểm thử

```bash
node --test test/*.test.js
```

Test chạy offline trên fixture HTML lấy từ trang thật, gồm cả ca hồi quy `[Anime Time] Crayon Shin-chan Movie 29`
(tên file release từng khiến addon trả về toàn phụ đề Dragon Ball) và các test chặn SSRF / path traversal của token.

Thử luồng thật có mạng:

```bash
node scripts/smoke.js tt13642590 movie "[Anime Time] Crayon Shin-chan Movie 29 - Shrouded in Mystery! The Flowers of Tenkasu Academy (2021) [BD][1080p][HEVC 10bit x265][Multi Sub].mkv"
```

Biến môi trường cho smoke test: `LANGS`, `SOURCES`, `OS_API_KEY`, `SUBDL_API_KEY`.

## Giới hạn đã biết

- SubtitleCat dịch tự động theo yêu cầu. Addon **chỉ đọc những ngôn ngữ đã có sẵn link tải** trên trang; ngôn ngữ chưa được dịch sẽ không xuất hiện. Nếu không thấy tiếng Việt, mở trang phim trên subtitlecat.com một lần để trang tạo bản dịch, sau đó Stremio sẽ thấy (cache tìm kiếm hết hạn sau 1 giờ).
- Phần lớn phụ đề trên SubtitleCat là bản dịch máy từ tiếng Anh — chất lượng thay đổi tuỳ bản.
- OpenSubtitles (bản không cần key) không trả tên release, nên cột release chỉ ghi "khớp IMDb" / "khớp hash file".
- OpenSubtitles API bản miễn phí giới hạn số lượt tải mỗi ngày.
- SubtitleCat và Subf2m là HTML thường, không có API chính thức. Nếu hai trang đổi giao diện thì sửa `parseSearch`/`parseDetail` trong `src/subtitlecat.js` và `parseTitles`/`parseSubList` trong `src/sources/subf2m.js` (test đã khoanh sẵn hai vùng này).
- Một số nguồn khác đã thử nhưng không dùng được: Podnapisi (không truy cập được), YIFY Subtitles (trả trang rỗng), Subscene (đã đóng cửa), opensubtitles.org và subdl.com bản web (chặn bot bằng Cloudflare).

## Thêm nguồn mới

Tạo một file trong `src/sources/` export default một object:

```js
export default {
  id: 'ten-nguon',
  name: 'Tên hiển thị',
  keyField: null,              // hoặc 'tenApiKey' nếu cần key trong config
  async find(ctx) { /* -> [{ code, langName, iso3, release, downloads, score, ref }] */ },
  validateRef(ref) { /* -> ref hợp lệ hoặc null */ },
  async fetch(ref, code, config) { /* -> nội dung .srt dạng chuỗi UTF-8 */ }
};
```

rồi thêm vào mảng `SOURCES` trong `src/sources/index.js`. Chấm điểm dùng chung qua `ctx.score(title)`;
`validateRef` là lớp bảo vệ bắt buộc vì `ref` đi qua URL công khai của addon.
