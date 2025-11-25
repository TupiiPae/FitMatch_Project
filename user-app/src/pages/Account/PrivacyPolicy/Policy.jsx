// user-app/src/pages/Account/PrivacyPolicy/Policy.jsx
import React from "react";
import "./Policy.css";

export default function Policy() {
  return (
    <article className="pp-policy">
      {/* GIỚI THIỆU */}
      <section id="pp-intro" className="pp-section">
        <p className="pp-p">
          Cảm ơn bạn đã lựa chọn trở thành một phần của cộng đồng trên ứng dụng
          di động FitMatch (sau đây gọi là &quot;Ứng dụng&quot;), hoặc tại
          website của chúng tôi (sau đây gọi là &quot;Website&quot;), hoặc được
          gọi chung là &quot;Dịch vụ của chúng tôi&quot;. Chúng tôi cam kết bảo
          vệ thông tin cá nhân và quyền riêng tư của bạn.
        </p>
        <p className="pp-p">
          Thông báo Chính sách Bảo mật này nhằm thông báo cho bạn về những
          thông tin chúng tôi thu thập về bạn, lý do chúng tôi cần thu thập dữ
          liệu này, cách chúng tôi sử dụng nó và các quyền của bạn liên quan đến
          nó. Chính sách này áp dụng khi bạn sử dụng Website hoặc Ứng dụng của
          chúng tôi. Bằng cách tiếp tục sử dụng Website, Ứng dụng và các Dịch
          vụ, bạn đồng ý với các nội dung của Chính sách Bảo mật này. Vì vậy,
          vui lòng đảm bảo rằng bạn đọc kỹ Chính sách Bảo mật này để hiểu cam
          kết của chúng tôi đối với bạn.
        </p>
        <p className="pp-p">
          Bất kỳ câu hỏi nào về Chính sách Bảo mật này, vui lòng gửi
          email cho chúng tôi tại{" "}
          <strong>fitmatchservice@gmail.com</strong>.
        </p>
      </section>

      {/* 1 */}
      <section id="pp-sec-1" className="pp-section">
        <h2 className="pp-h2">1. THÔNG TIN CHÚNG TÔI THU THẬP</h2>

        <p className="pp-p">
          <strong>Thông tin cá nhân bạn cung cấp cho chúng tôi</strong>
        </p>
        <p className="pp-p">
          Chúng tôi thu thập thông tin cá nhân mà bạn tự nguyện cung cấp khi
          đăng ký Dịch vụ, thể hiện sự quan tâm đến việc nhận thông tin về chúng
          tôi hoặc Dịch vụ, khi bạn đăng tải nội dung (như tin nhắn, hình ảnh,
          chỉ số cơ thể, mục tiêu tập luyện...) hoặc khi bạn liên hệ với chúng
          tôi.
        </p>
        <p className="pp-p">
          Thông tin cá nhân chúng tôi thu thập phụ thuộc vào bối cảnh tương tác
          của bạn với FitMatch, các lựa chọn bạn thực hiện và các sản phẩm cũng
          như tính năng bạn sử dụng. Thông tin cá nhân chúng tôi thu thập có thể
          bao gồm:
        </p>
        <ul className="pp-list">
          <li>
            <strong>Thông tin tài khoản:</strong> Bao gồm tên, địa chỉ email,
            tên người dùng, mật khẩu, sở thích liên hệ và các thông tin tương
            tự.
          </li>
          <li>
            <strong>Thông tin mua hàng:</strong> Nếu bạn mua bất kỳ dịch vụ trả
            phí nào, bạn có thể cần cung cấp phương thức thanh toán hợp lệ và
            thông tin thanh toán liên quan. Chúng tôi sử dụng các đối tác xử lý
            thanh toán (như Stripe, PayPal, hoặc các cổng thanh toán nội địa).
            Tùy thuộc vào bên xử lý, chúng tôi có thể nhận và lưu trữ một số
            thông tin thanh toán nhất định, bao gồm 4 chữ số cuối của thẻ tín
            dụng.
          </li>
          <li>
            <strong>Dữ liệu đăng nhập mạng xã hội:</strong> Chúng tôi có thể
            cung cấp tùy chọn đăng ký bằng tài khoản mạng xã hội hiện có của
            bạn (như Facebook, Google). Nếu bạn chọn cách này, chúng tôi sẽ thu
            thập thông tin như được mô tả trong phần &quot;Cách chúng tôi xử lý
            thông tin đăng nhập xã hội&quot; bên dưới.
          </li>
          <li>
            <strong>Dữ liệu sức khỏe và thể chất (đặc thù của FitMatch):</strong>{" "}
            Để phục vụ tính năng tính toán dinh dưỡng và ghép đôi, chúng tôi thu
            thập các chỉ số như chiều cao, cân nặng, BMI, mục tiêu tập luyện và
            chế độ ăn uống mà bạn nhập vào.
          </li>
        </ul>

        <p className="pp-p">
          <strong>Thông tin được thu thập tự động</strong>
        </p>
        <p className="pp-p">
          Một số thông tin được tự động thu thập khi bạn truy cập, sử dụng hoặc
          điều hướng Dịch vụ của chúng tôi. Thông tin này không tiết lộ danh
          tính cụ thể của bạn (như tên hoặc thông tin liên hệ) nhưng chủ yếu
          cần thiết để duy trì bảo mật và hoạt động của Dịch vụ, cũng như cho
          mục đích phân tích và báo cáo nội bộ. Các loại dữ liệu này có thể bao
          gồm:
        </p>
        <ul className="pp-list">
          <li>
            <strong>Dữ liệu nhật ký và sử dụng:</strong> Bao gồm địa chỉ IP,
            thông tin thiết bị, loại trình duyệt, cài đặt và thông tin về hoạt
            động của bạn trên Dịch vụ (như dấu thời gian, trang đã xem, tìm kiếm
            đã thực hiện).
          </li>
          <li>
            <strong>Dữ liệu thiết bị:</strong> Thông tin về máy tính, điện thoại,
            máy tính bảng hoặc thiết bị khác bạn sử dụng để truy cập FitMatch.
          </li>
          <li>
            <strong>Dữ liệu vị trí:</strong> Chúng tôi thu thập dữ liệu vị trí
            (chính xác hoặc không chính xác) để hỗ trợ tính năng tìm kiếm bạn
            tập (Gym Buddy) quanh khu vực. Bạn có thể từ chối quyền truy cập
            này trong cài đặt thiết bị, tuy nhiên điều này có thể làm hạn chế
            một số tính năng của Dịch vụ.
          </li>
        </ul>
      </section>

      {/* 2 */}
      <section id="pp-sec-2" className="pp-section">
        <h2 className="pp-h2">2. CÁCH CHÚNG TÔI SỬ DỤNG THÔNG TIN CỦA BẠN</h2>
        <p className="pp-p">
          Chúng tôi sử dụng thông tin cá nhân thu thập được cho các mục đích
          kinh doanh sau đây, dựa trên lợi ích kinh doanh hợp pháp, để thực hiện
          hợp đồng với bạn, với sự đồng ý của bạn và/hoặc để tuân thủ các nghĩa
          vụ pháp lý. Các mục đích chính bao gồm:
        </p>
        <ul className="pp-list">
          <li>
            Hỗ trợ tạo tài khoản và đăng nhập, bao gồm cả việc sử dụng thông tin
            từ bên thứ ba (Google/Facebook) nếu bạn chọn liên kết tài khoản.
          </li>
          <li>
            Cung cấp và duy trì các tính năng cốt lõi của FitMatch như nhật ký
            dinh dưỡng, tính toán calo, gợi ý bài tập và ghép đôi bạn tập.
          </li>
          <li>
            Gửi thông tin quản trị: thông báo về sản phẩm, dịch vụ, tính năng
            mới hoặc thay đổi điều khoản/chính sách.
          </li>
          <li>
            Phân tích dữ liệu sử dụng để cải tiến giao diện, hiệu năng và trải
            nghiệm người dùng.
          </li>
          <li>
            Bảo vệ Dịch vụ: giám sát và ngăn chặn gian lận, lạm dụng hoặc hành
            vi vi phạm điều khoản sử dụng.
          </li>
          <li>
            Gửi thông tin tiếp thị và quảng cáo phù hợp với sở thích của bạn
            (khi có sự đồng ý); bạn có thể từ chối nhận bất cứ lúc nào.
          </li>
        </ul>
      </section>

      {/* 3 */}
      <section id="pp-sec-3" className="pp-section">
        <h2 className="pp-h2">3. CHIA SẺ THÔNG TIN CỦA BẠN</h2>
        <p className="pp-p">
          Chúng tôi chỉ chia sẻ thông tin với sự đồng ý của bạn, để tuân thủ
          pháp luật, cung cấp dịch vụ, bảo vệ quyền lợi của bạn hoặc thực hiện
          nghĩa vụ kinh doanh. Các đối tượng có thể nhận thông tin bao gồm:
        </p>
        <ul className="pp-list">
          <li>
            <strong>Chuyển giao kinh doanh:</strong> Chúng tôi có thể chia sẻ
            hoặc chuyển giao thông tin của bạn liên quan đến việc sáp nhập, bán
            tài sản công ty, hoặc mua lại toàn bộ hoặc một phần hoạt động kinh
            doanh.
          </li>
          <li>
            <strong>Người dùng khác:</strong> Khi bạn chia sẻ thông tin cá nhân
            (ví dụ: đăng nhận xét, bài viết hoặc tham gia vào khu vực
            công cộng/ghép đôi), thông tin này có thể được xem bởi người dùng
            khác.
          </li>
          <li>
            <strong>Đối tác kinh doanh:</strong> Chia sẻ với các đối tác để cung
            cấp cho bạn một số sản phẩm, dịch vụ hoặc chương trình khuyến mãi
            nhất định.
          </li>
          <li>
            <strong>Nghĩa vụ pháp lý:</strong> Tiết lộ thông tin khi được yêu
            cầu bởi luật pháp, quy trình tư pháp, lệnh tòa án hoặc cơ quan nhà
            nước có thẩm quyền.
          </li>
        </ul>
      </section>

      {/* 4 */}
      <section id="pp-sec-4" className="pp-section">
        <h2 className="pp-h2">4. COOKIES VÀ CÔNG NGHỆ THEO DÕI</h2>
        <p className="pp-p">
          Chúng tôi có thể sử dụng cookie và các công nghệ theo dõi tương tự
          (như web beacons và pixels) để truy cập hoặc lưu trữ thông tin. Hầu
          hết các trình duyệt web được thiết lập để chấp nhận cookie theo mặc
          định. Bạn có thể chọn thiết lập trình duyệt để loại bỏ hoặc từ chối
          cookie; tuy nhiên điều này có thể ảnh hưởng đến một số tính năng của
          FitMatch.
        </p>
      </section>

      {/* 5 */}
      <section id="pp-sec-5" className="pp-section">
        <h2 className="pp-h2">5. CÁCH CHÚNG TÔI XỬ LÝ ĐĂNG NHẬP XÃ HỘI</h2>
        <p className="pp-p">
          Nếu bạn chọn đăng ký hoặc đăng nhập bằng tài khoản mạng xã hội
          (Facebook, Google...), chúng tôi sẽ nhận được thông tin hồ sơ nhất
          định từ nhà cung cấp đó (thường bao gồm tên, email, danh sách bạn bè,
          ảnh đại diện). Chúng tôi chỉ sử dụng thông tin này cho các mục đích
          được mô tả trong chính sách này. Chúng tôi không kiểm soát và không
          chịu trách nhiệm về các việc sử dụng thông tin cá nhân khác của nhà
          cung cấp mạng xã hội của bạn.
        </p>
      </section>

      {/* 6 */}
      <section id="pp-sec-6" className="pp-section">
        <h2 className="pp-h2">6. QUẢNG CÁO CỦA BÊN THỨ BA</h2>
        <p className="pp-p">
          Dịch vụ của chúng tôi có thể chứa quảng cáo từ các bên thứ ba không
          liên kết với chúng tôi. Chúng tôi không đảm bảo sự an toàn và quyền
          riêng tư của dữ liệu bạn cung cấp cho bất kỳ bên thứ ba nào. Mọi dữ
          liệu được thu thập bởi bên thứ ba không thuộc phạm vi của chính sách
          bảo mật này; bạn nên đọc chính sách riêng của họ trước khi cung cấp
          thông tin.
        </p>
      </section>

      {/* 7 */}
      <section id="pp-sec-7" className="pp-section">
        <h2 className="pp-h2">7. THỜI GIAN LƯU TRỮ THÔNG TIN</h2>
        <p className="pp-p">
          Chúng tôi sẽ chỉ lưu giữ thông tin cá nhân của bạn trong thời gian cần
          thiết cho các mục đích được nêu trong chính sách này, trừ khi thời
          gian lưu giữ lâu hơn được pháp luật yêu cầu hoặc cho phép. Khi không
          còn nhu cầu kinh doanh hợp pháp, chúng tôi sẽ xóa hoặc ẩn danh thông
          tin đó.
        </p>
      </section>

      {/* 8 */}
      <section id="pp-sec-8" className="pp-section">
        <h2 className="pp-h2">8. CÁCH CHÚNG TÔI GIỮ AN TOÀN THÔNG TIN</h2>
        <p className="pp-p">
          Chúng tôi đã triển khai các biện pháp bảo mật kỹ thuật và tổ chức phù
          hợp để bảo vệ an toàn cho mọi thông tin cá nhân mà chúng tôi xử lý.
          Tuy nhiên, xin lưu ý rằng không có phương thức truyền tải qua Internet
          hoặc công nghệ lưu trữ nào là an toàn 100%. Mặc dù chúng tôi sẽ cố
          gắng hết sức để bảo vệ thông tin cá nhân của bạn, việc truyền tải
          thông tin đến và đi từ Dịch vụ của chúng tôi là rủi ro riêng của bạn.
        </p>
      </section>

      {/* 9 */}
      <section id="pp-sec-9" className="pp-section">
        <h2 className="pp-h2">9. QUYỀN RIÊNG TƯ CỦA BẠN</h2>
        <p className="pp-p">
          Tại một số khu vực, bạn có các quyền nhất định theo luật bảo vệ dữ
          liệu hiện hành. Các quyền này có thể bao gồm:
        </p>
        <ul className="pp-list">
          <li>Yêu cầu truy cập và lấy bản sao thông tin cá nhân của bạn.</li>
          <li>Yêu cầu chỉnh sửa hoặc xóa bỏ thông tin không chính xác.</li>
          <li>Hạn chế xử lý thông tin cá nhân của bạn.</li>
          <li>Quyền phản đối việc xử lý thông tin cá nhân trong một số trường hợp.</li>
        </ul>
        <p className="pp-p">
          Nếu bạn muốn xem lại, thay đổi hoặc chấm dứt tài khoản của mình, bạn
          có thể đăng nhập vào cài đặt tài khoản và thực hiện thao tác xóa, hoặc
          liên hệ với chúng tôi qua email:{" "}
          <strong>support@fitmatch.com</strong>.
        </p>
        <p className="pp-p">
          Khi nhận được yêu cầu chấm dứt tài khoản, chúng tôi sẽ hủy kích hoạt
          hoặc xóa tài khoản và thông tin của bạn khỏi cơ sở dữ liệu hoạt động.
          Tuy nhiên, chúng tôi có thể giữ lại một số thông tin trong hồ sơ để
          ngăn chặn gian lận, khắc phục sự cố hoặc tuân thủ các yêu cầu pháp
          lý.
        </p>
      </section>

      {/* 10 */}
      <section id="pp-sec-10" className="pp-section">
        <h2 className="pp-h2">
          10. QUYỀN RIÊNG TƯ CHO CƯ DÂN CALIFORNIA (CCPA)
        </h2>
        <p className="pp-p">
          (Phần này áp dụng nếu FitMatch có người dùng tại California, Hoa Kỳ.
          Nếu chỉ hoạt động tại Việt Nam, phần này thể hiện sự tuân thủ các tiêu
          chuẩn quốc tế cao nhất.)
        </p>
        <p className="pp-p">
          Theo luật CCPA, cư dân California có quyền yêu cầu thông tin về các
          loại thông tin cá nhân (nếu có) mà chúng tôi đã tiết lộ cho bên thứ ba
          cho mục đích tiếp thị trực tiếp. Trong 12 tháng qua, FitMatch có thể
          đã thu thập các loại thông tin cá nhân sau (ví dụ):
        </p>
        <ul className="pp-list">
          <li>Danh tính (Tên, Email, IP): CÓ</li>
          <li>
            Thông tin được liệt kê trong Hồ sơ Khách hàng California (Tên, thông
            tin liên hệ): CÓ
          </li>
          <li>Đặc điểm được bảo vệ (Giới tính, ngày sinh): CÓ</li>
          <li>Hoạt động mạng (Lịch sử duyệt web, tương tác): CÓ</li>
          <li>Dữ liệu địa lý: CÓ</li>
          <li>Thông tin sinh trắc học: KHÔNG</li>
        </ul>
        <p className="pp-p">
          Quyền của bạn đối với dữ liệu cá nhân theo CCPA có thể bao gồm:
        </p>
        <ul className="pp-list">
          <li>Quyền yêu cầu xóa dữ liệu cá nhân.</li>
          <li>
            Quyền được biết liệu chúng tôi có thu thập, sử dụng hoặc bán thông
            tin của bạn hay không.
          </li>
          <li>
            Quyền không bị phân biệt đối xử khi bạn thực hiện các quyền riêng
            tư của mình.
          </li>
        </ul>
        <p className="pp-p">
          Để thực hiện các quyền này, vui lòng liên hệ với chúng tôi qua email{" "}
          <strong>support@fitmatch.com</strong>.
        </p>
      </section>

      {/* 11 */}
      <section id="pp-sec-11" className="pp-section">
        <h2 className="pp-h2">11. CẬP NHẬT THÔNG BÁO</h2>
        <p className="pp-p">
          Chúng tôi có thể cập nhật thông báo bảo mật này theo thời gian. Phiên
          bản cập nhật sẽ được chỉ định bằng ngày &quot;Cập nhật lần cuối&quot;
          mới và sẽ có hiệu lực ngay khi được công bố. Chúng tôi khuyến khích
          bạn xem lại thông báo bảo mật này thường xuyên để được thông báo về
          cách chúng tôi bảo vệ thông tin của bạn.
        </p>
      </section>

      {/* 12 */}
      <section id="pp-sec-12" className="pp-section">
        <h2 className="pp-h2">12. LIÊN HỆ VỚI CHÚNG TÔI</h2>
        <p className="pp-p">
          Nếu bạn có câu hỏi hoặc nhận xét về chính sách này, vui lòng gửi email
          cho chúng tôi tại:
        </p>
        <p className="pp-p">
          Bộ phận Hỗ trợ FitMatch – Email:{" "}
          <strong>fitmatchservice@gmail.com</strong>
        </p>
        <p className="pp-p">
          FitMatch cam kết chỉ thu thập những gì thực sự cần thiết, minh bạch về
          mục đích sử dụng và áp dụng các biện pháp bảo vệ phù hợp để gìn giữ
          quyền riêng tư của bạn.
        </p>
      </section>
    </article>
  );
}
