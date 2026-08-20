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
| `MEDIA_DIR` | `./media` | Thư mục phim local để phát qua resource `stream` — xem mục dưới |
| `MEDIA_TTL` | `60` | Số giây cache kết quả quét thư mục media |
| `LINKS_FILE` | `./links.json` | File ghim link nền tảng + tên tiếng Việt |

## Link "xem hợp pháp ở đâu"

Trong tab Streams của mỗi phim, addon thêm các mục `▶ Galaxy Play`, `▶ VieON`, `▶ FPT Play`, `▶ Netflix`…
Bấm vào sẽ mở app/trang của nền tảng đó — dùng khi bạn muốn xem bản lồng tiếng chính chủ thay vì phụ đề dịch máy.

Chọn nền tảng trong `/configure`. Bỏ chọn hết là tắt hẳn, khi đó resource `stream` không được quảng cáo nữa.

| Nền tảng | Khu vực | URL tìm kiếm (đã kiểm tra trả 200) |
|---|---|---|
| Galaxy Play | VN | `galaxyplay.vn/search?q=` |
| VieON | VN | `vieon.vn/tim-kiem?q=` |
| FPT Play | VN | `fptplay.vn/tim-kiem?keyword=` |
| TV360 | VN | `tv360.vn/search?q=` |
| POPS | VN | `pops.vn/search?q=` |
| Netflix | global | `netflix.com/search?q=` |
| Prime Video | global | `primevideo.com/search?phrase=` |
| Apple TV | global | `tv.apple.com/vn/search?term=` |

### Ghim link chính xác bằng `links.json`

Mặc định addon tìm theo tên phim từ Cinemeta — mà tên đó là **tiếng Anh**, nên tìm trên nền tảng VN thường ra rỗng.
File `links.json` ở thư mục gốc cho phép ghim tên tiếng Việt và link phim trực tiếp:

```json
{
  "tt13642590": {
    "title": "Shin Cậu Bé Bút Chì: Bí Ẩn! Học Viện Hoa Lệ Tenkasu",
    "galaxyplay": "https://galaxyplay.vn/title/shin-cau-be-but-chi-bi-an-hoc-vien-hoa-le-tenkasu"
  }
}
```

`title` dùng cho mọi nền tảng chưa được ghim link. Đổi đường dẫn file bằng `LINKS_FILE`, sửa xong có hiệu lực sau 60 giây.

Link ghim bị **kiểm tra tên miền**: phải là `https` và phải đúng tên miền của nền tảng đó.
`https://evil.com/x`, `http://vieon.vn/x`, `https://galaxyplay.vn.evil.com/x` đều bị bỏ và tự quay về link tìm kiếm —
để một file `links.json` bị sửa bậy không biến addon thành open redirect.

### Trên TV

- `externalUrl` giữ nguyên **link gốc của nền tảng**, không đi vòng qua addon — để app trên Android TV còn cơ hội bắt được bằng deep link.
- Phần mô tả của mỗi mục hiện một **URL rút gọn** dạng `http://<addon>/go/galaxyplay/tt13642590`.
  Link tìm kiếm tiếng Việt sau khi percent-encode dài tới ~200 ký tự, không đọc nổi trên màn hình TV;
  dạng rút gọn này đọc và gõ tay được bằng điện thoại. Route `/go/` dựng lại link từ `links.json` + Cinemeta rồi trả `302`.

**Chưa kiểm chứng được:** mình không có TV để test. Trên Android TV, `externalUrl` mở qua `Intent.ACTION_VIEW`,
nên chỉ nhảy thẳng vào app khi app đó khai báo deep link cho tên miền tương ứng (Netflix có; các app VN thì chưa rõ).
Máy nào không có trình duyệt và không app nào nhận link thì mục đó sẽ không mở được — lúc ấy phải dùng URL rút gọn ở phần mô tả.
Trên Stremio Web và Stremio desktop thì link mở tab mới bình thường.

## Phát file local (để xem bản lồng tiếng Việt)

Addon phụ đề **không thể** thêm track audio vào Stremio — protocol chỉ cho resource `subtitles` trả file `.srt`.
Cách duy nhất để nghe lồng tiếng là track đó nằm sẵn trong file video. Nên addon có thêm resource `stream`
phục vụ file video trong một thư mục local: bạn mux track tiếng Việt vào file bằng ffmpeg, bỏ vào thư mục đó,
Stremio sẽ thấy nó ngay ở đúng trang phim và cho đổi track audio trong trình phát.

Bật bằng cách trỏ `MEDIA_DIR` tới thư mục phim (mặc định là `./media`):

```bash
MEDIA_DIR=/duong/dan/toi/phim node src/server.js
```

Không có thư mục thì resource `stream` **không được quảng cáo** trong manifest, addon chạy y như cũ.

### Đặt tên file

| Cách | Độ tin cậy |
|---|---|
| Có `tt13642590` trong tên file hoặc tên thư mục | **Chắc chắn** — khớp tuyệt đối, đặt tên tiếng Việt thoải mái |
| Không có id | Đối chiếu tên phim từ Cinemeta bằng chính bộ chấm điểm của addon — chỉ hợp với tên tiếng Anh |

Phim bộ cần thêm tag tập (`S01E02`) trong tên. File nhỏ hơn 1 MB và file không phải video bị bỏ qua.
Thư mục được quét đệ quy tối đa 4 cấp, kết quả cache 60 giây (đổi bằng `MEDIA_TTL`).

Nếu máy có `ffprobe` (đi kèm ffmpeg), addon đọc luôn danh sách track audio và hiện trong Stremio
(vd `2 track: jpn + vie`), file nào có track tiếng Việt được đẩy lên đầu và gắn nhãn `Local · VI`.
Không có ffprobe thì đoán theo tên file (`LT`, `Lồng tiếng`, `Thuyết minh`, `VIE`…).

### Mux track lồng tiếng vào file

```bash
ffmpeg -i video.mkv -i audio_vi.m4a -map 0:v -map 0:a -map 1:a -c copy -metadata:s:a:0 language=jpn -metadata:s:a:1 language=vie -disposition:a:1 default output.mkv
```

Nếu tiếng Việt bị trễ đều so với hình, thêm `-itsoffset 1.2` ngay trước `-i audio_vi.m4a`.
Nếu đầu phim khớp mà càng về cuối càng lệch thì là chênh framerate (25fps PAL vs 23.976), phải kéo giãn audio trước:

```bash
ffmpeg -i audio_vi.m4a -filter:a "atempo=0.95904" -c:a aac -b:a 192k audio_fixed.m4a
```

### Bảo mật

Route `/media/<token>` chỉ phục vụ **file đang có trong index** — token trỏ ra ngoài `MEDIA_DIR`,
trỏ tới file chưa được quét, hay token rác đều trả 404. Có hỗ trợ HTTP Range đầy đủ
(206, `bytes=a-b`, `bytes=a-`, `bytes=-n`, 416 khi vượt kích thước) nên tua trong Stremio hoạt động bình thường.

Lưu ý: thư mục media chỉ có ý nghĩa khi tự host. Trên Vercel/serverless không có ổ đĩa cố định nên tính năng này tự tắt.

## Deploy lên Vercel

Repo đã có sẵn `vercel.json` và `api/index.js`, deploy thẳng không cần cấu hình gì thêm:

- Mọi request được rewrite về `api/index.js`, file này re-export `handleRequest` từ `src/server.js`,
  nên chạy trên serverless **giống hệt** khi tự host bằng Node.
- `includeFiles: "public/**"` là bắt buộc — không có nó, Vercel không đóng gói `configure.html` vào function và trang `/configure` sẽ lỗi 500.
- Nhớ đặt biến môi trường `PUBLIC_URL=https://ten-mien-cua-ban`, vì link tải phụ đề trỏ về chính addon.

Lưu ý: trên serverless, cache nằm trong RAM của từng instance nên mỗi lần cold start sẽ phải tải lại từ nguồn — chậm hơn lần đầu, không ảnh hưởng kết quả.

Tự host bằng Node thì không cần hai file trên.

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
