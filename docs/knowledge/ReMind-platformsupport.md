**ReMind \- Nền tảng hỗ trợ giải quyết tâm lý**

**1\. Các vấn đề hiện tại đang mắc phải:**  
Hiện nay, học sinh/sinh viên (Gen Z) phải đối mặt với nhiều áp lực từ học tập, định hướng và mạng xã hội. Tuy nhiên, việc tiếp cận các dịch vụ hỗ trợ tâm lý chuyên nghiệp gặp nhiều rào cản về chi phí, thời gian và đặc biệt là tâm lý e ngại, sợ lộ danh tính.   
**\=\> Giải pháp của web:** Xây dựng một nền tảng hỗ trợ tâm lý từ xa kết hợp giữa AI và Chuyên gia tâm lý thật. 

**2\. Mô hình Kinh doanh (Monetization & Business Model):**

Dự án vận hành theo mô hình **Freemium:**

* **Miễn phí:** Người dùng được sử dụng AI Chatbot để tâm sự sơ bộ và tham gia diễn đàn cộng đồng.  
* **Thu phí:** Trả phí theo phiên để đặt lịch tư vấn 1-1 với Chuyên gia tâm lý.  
* **Dòng doanh thu:** Nền tảng thu phí hoa hồng trên mỗi giao dịch đặt lịch thành công qua cổng thanh toán.

**3\. Các phân hệ chức năng chính (Core Features):** 

**A. Khách (Guests):**

* Xem chi tiết hồ sơ chuyên gia và xem các bài đăng trên diễn đàn cộng đồng.  
* Đăng ký.  
* Đăng nhập (tài khoản/mật khẩu hoặc Google) .

**B. Học sinh / Sinh viên (Students):**

* Xem hồ sơ, chỉnh sửa hồ sơ (chỉnh sửa tên, mật khẩu, xác lập tài khoản Ẩn danh).  
* Trò chuyện với AI, tương tác trên diễn đàn (đăng/bình luận/sửa/xóa bài).  
* Thực hiện đặt lịch với chuyên gia.  
* Gửi tin nhắn cho chuyên gia (sau khi thanh toán thành công).  
* Gửi các báo cáo vi phạm hoặc lỗi.

**C. Chuyên gia tâm lý (Psychological Experts):**

* Chỉnh sửa hồ sơ chuyên gia.  
* Kiểm tra lịch trình và thiết lập số ca nhận tối đa.  
* Xem danh sách lịch hẹn, có thể mở rộng tải xuống danh sách.  
* Bắt đầu ca tư vấn và xác nhận hoàn thành ca khám.   
* Xem báo cáo hiệu suất.

**D. Quản trị viên (Admin):**

* Xem hồ sơ, duyệt/từ chối cấp phép hoạt động .  
* Tạo diễn đàn, cập nhật diễn đàn.   
* Xem các báo cáo vi phạm và có thể thực hiện Cấm người dùng nếu vi phạm.  
* Thay đổi phân quyền tài khoản.  
* Xem báo cáo tài chính, chỉnh sửa tỷ lệ hoa hồng  
* Xem phân tích hệ thống với các bộ lọc mở rộng theo tuần/tháng/năm.  

**4\. Các tác nhân và tính năng mở rộng đã bổ sung trong thiết kế hệ thống:**

**E. Quản lý tổ chức (Manager):**

* Quản lý thành viên thuộc tổ chức/trường học/doanh nghiệp.  
* Gửi lời mời tham gia tổ chức qua email hoặc mã tham gia.  
* Phân bổ lượt tư vấn hoặc lượt AI chat từ gói của tổ chức cho từng học sinh/sinh viên.  
* Xem báo cáo tổng hợp đã ẩn danh của tổ chức, không được xem nội dung chat, ghi chú tư vấn, dữ liệu khủng hoảng hoặc thông tin sức khỏe tâm lý riêng tư.  

**F. Tổ chức (Organization):**

* Đại diện cho trường học, doanh nghiệp hoặc nhóm mua gói hỗ trợ tâm lý cho nhiều người dùng.  
* Có gói đăng ký riêng, số lượng chỗ ngồi thành viên và ví tín dụng dùng chung.  
* Hỗ trợ mã tham gia, giới hạn số lượt dùng, hạn sử dụng, kiểm tra domain email và duyệt tham gia nếu cần.  

**G. Quản lý hệ thống (System Manager):**

* Tạo và quản lý tài khoản quản trị viên.  
* Cấp hoặc thu hồi quyền quản trị viên.  
* Quản lý các thiết lập cấp cao của nền tảng.  

**H. AI:**

* Đóng vai trò là người tham gia không phải con người trong phòng chat AI.  
* Hỗ trợ phát hiện rủi ro trong tin nhắn, gắn cờ mức độ nguy cơ và kích hoạt luồng hỗ trợ khẩn cấp khi cần.  

**5\. Các nhóm tính năng cần lưu trong cơ sở dữ liệu:**

* Hồ sơ người dùng, phân quyền, trạng thái tài khoản và chế độ ẩn danh.  
* Hồ sơ chuyên gia, chuyên môn, bằng cấp/chứng chỉ, giấy phép hành nghề, duyệt hoạt động và thống kê hiệu suất.  
* Gói đăng ký, ví tín dụng, lịch sử giao dịch tín dụng và gói mua thêm lượt tư vấn/AI chat.  
* Thanh toán, mã giao dịch nhà cung cấp, hoa hồng nền tảng, thanh toán cho chuyên gia và chống lạm dụng dùng thử.  
* Lịch làm việc chuyên gia, khung giờ tư vấn, khóa slot khi đặt lịch, lịch hẹn, hủy lịch, đổi lịch, hoàn thành ca và xử lý no-show.  
* Chat AI, chat sau khi đặt lịch, chat hỗ trợ khẩn cấp, chat nhóm hỗ trợ và lời mời vào phòng chat.  
* Yêu cầu hỗ trợ khẩn cấp, đánh giá rủi ro tự khai báo, AI phát hiện rủi ro, tài nguyên khẩn cấp và chuyên gia trực hỗ trợ.  
* Diễn đàn, bài đăng, bình luận, hiển thị ẩn danh và trạng thái kiểm duyệt.  
* Báo cáo vi phạm/lỗi cho người dùng, chuyên gia, lịch hẹn, diễn đàn, tin nhắn chat và lỗi kỹ thuật.  
* Đánh giá chuyên gia sau lịch hẹn đã hoàn thành; báo cáo chỉ ảnh hưởng hiệu suất chuyên gia sau khi admin xác minh.  
* Gói tổ chức, thành viên tổ chức, lời mời, mã tham gia, lượt quy đổi mã và phân bổ tín dụng cho thành viên.  
* Chia sẻ báo cáo hiệu suất chuyên gia cho tổ chức dưới dạng tổng hợp/ẩn danh.  
* Thông báo thời gian thực, tệp tải lên, ảnh đã tối ưu, link ký tạm thời cho tệp nhạy cảm, nhật ký hệ thống và thiết lập nền tảng.  
  
