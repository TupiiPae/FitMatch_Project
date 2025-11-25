// user-app/src/pages/Account/TermsConditions/TermsConditions.jsx
import React from "react";
import "./TermsConditions.css";

export default function TermsConditions() {
  return (
    <article className="tc-terms">

      {/* 1 */}
      <section id="tc-sec-1" className="tc-section">
        <h2 className="tc-h2">1. THỎA THUẬN VỀ CÁC ĐIỀU KHOẢN</h2>
        <p className="tc-p">
          Các Điều khoản Sử dụng này cấu thành một thỏa thuận pháp lý ràng buộc
          giữa bạn, dù là cá nhân hay đại diện cho một tổ chức (&quot;bạn&quot;)
          và FitMatch (&quot;Công ty&quot;, &quot;chúng tôi&quot;), liên quan
          đến việc bạn truy cập và sử dụng website FitMatch cũng như bất kỳ hình
          thức truyền thông, kênh truyền thông, website di động hoặc ứng dụng
          di động nào liên quan, được liên kết hoặc kết nối với nó (gọi chung là
          &quot;Trang web/Ứng dụng&quot;).
        </p>
        <p className="tc-p">
          Bằng cách truy cập Trang web/Ứng dụng, bạn xác nhận rằng bạn đã đọc,
          hiểu và đồng ý bị ràng buộc bởi tất cả các Điều khoản Sử dụng này.
          <strong>
            {" "}
            NẾU BẠN KHÔNG ĐỒNG Ý VỚI TẤT CẢ CÁC ĐIỀU KHOẢN SỬ DỤNG NÀY, BẠN BỊ
            CẤM SỬ DỤNG TRANG WEB/ỨNG DỤNG VÀ PHẢI NGỪNG SỬ DỤNG NGAY LẬP TỨC.
          </strong>
        </p>
        <p className="tc-p">
          Chúng tôi có quyền, theo quyết định riêng của mình, thực hiện các thay
          đổi hoặc sửa đổi đối với các Điều khoản Sử dụng này bất cứ lúc nào và
          vì bất kỳ lý do gì. Chúng tôi sẽ thông báo cho bạn về bất kỳ thay đổi
          nào bằng cách cập nhật ngày &quot;Cập nhật lần cuối&quot; của các Điều
          khoản này.
        </p>
      </section>

      {/* 2 */}
      <section id="tc-sec-2" className="tc-section">
        <h2 className="tc-h2">2. QUYỀN SỞ HỮU TRÍ TUỆ</h2>
        <p className="tc-p">
          Trừ khi có chỉ định khác, Trang web/Ứng dụng là tài sản độc quyền của
          chúng tôi. Tất cả mã nguồn, cơ sở dữ liệu, chức năng, phần mềm, thiết
          kế website, âm thanh, video, văn bản, hình ảnh và đồ họa trên Trang
          web (gọi chung là &quot;Nội dung&quot;) và các nhãn hiệu, nhãn hiệu
          dịch vụ và logo chứa trong đó (&quot;Nhãn hiệu&quot;) đều thuộc sở
          hữu hoặc kiểm soát của chúng tôi hoặc được cấp phép cho chúng tôi, và
          được bảo vệ bởi luật bản quyền và thương hiệu.
        </p>
        <p className="tc-p">
          Nội dung và Nhãn hiệu được cung cấp trên Trang web &quot;NGUYÊN
          TRẠNG&quot; chỉ để bạn tham khảo và sử dụng cá nhân. Không được phép
          sao chép, tái tạo, tổng hợp, tái xuất bản, tải lên, đăng, hiển thị
          công khai, mã hóa, dịch, truyền, phân phối, bán, cấp phép hoặc khai
          thác cho bất kỳ mục đích thương mại nào mà không có sự cho phép trước
          bằng văn bản của chúng tôi.
        </p>
      </section>

      {/* 3 */}
      <section id="tc-sec-3" className="tc-section">
        <h2 className="tc-h2">3. TUYÊN BỐ CỦA NGƯỜI DÙNG</h2>
        <p className="tc-p">Bằng cách sử dụng Trang web, bạn tuyên bố và bảo đảm rằng:</p>
        <ul className="tc-list">
          <li>Bạn có năng lực pháp lý và đồng ý tuân thủ các Điều khoản này.</li>
          <li>
            Bạn không phải là người chưa thành niên tại khu vực bạn cư trú (hoặc
            có sự giám sát của phụ huynh).
          </li>
          <li>
            Bạn sẽ không truy cập Trang web thông qua các phương tiện tự động
            hoặc phi con người (bot, script).
          </li>
          <li>
            Bạn sẽ không sử dụng Trang web cho bất kỳ mục đích bất hợp pháp hoặc
            trái phép nào.
          </li>
          <li>
            Việc sử dụng của bạn sẽ không vi phạm bất kỳ luật hoặc quy định hiện
            hành nào.
          </li>
        </ul>
      </section>

      {/* 4 */}
      <section id="tc-sec-4" className="tc-section">
        <h2 className="tc-h2">4. ĐĂNG KÝ NGƯỜI DÙNG</h2>
        <p className="tc-p">
          Bạn có thể cần đăng ký tài khoản để sử dụng các tính năng quản lý dinh
          dưỡng và ghép đôi (matching). Bạn đồng ý giữ mật khẩu của mình bí mật
          và chịu trách nhiệm cho tất cả các hoạt động sử dụng tài khoản và mật
          khẩu của bạn. Chúng tôi có quyền xóa, thu hồi hoặc thay đổi tên người
          dùng nếu xác định rằng tên đó không phù hợp hoặc phản cảm.
        </p>
      </section>

      {/* 5 */}
      <section id="tc-sec-5" className="tc-section">
        <h2 className="tc-h2">5. PHÍ VÀ THANH TOÁN</h2>
        <p className="tc-p">
          FitMatch có thể cung cấp các gói dịch vụ trả phí (Premium) để mở khóa
          các tính năng nâng cao. Chúng tôi chấp nhận các hình thức thanh toán
          sau:
        </p>
        <ul className="tc-list">
          <li>Thẻ Tín dụng / Ghi nợ (Visa, Mastercard)</li>
          <li>Ví điện tử (Momo, ZaloPay, v.v. - tùy tích hợp)</li>
          <li>Thanh toán qua kho ứng dụng (Apple Pay, Google Pay)</li>
        </ul>
        <p className="tc-p">
          Bạn đồng ý cung cấp thông tin thanh toán và tài khoản hiện tại, đầy đủ
          và chính xác cho tất cả các giao dịch mua hàng. Bạn đồng ý thanh toán
          mọi khoản phí theo mức giá có hiệu lực cho giao dịch mua của mình và
          cho phép chúng tôi tính phí nhà cung cấp thanh toán đã chọn của bạn.
        </p>
      </section>

      {/* 6 */}
      <section id="tc-sec-6" className="tc-section">
        <h2 className="tc-h2">6. THAY ĐỔI GIÁ CẢ</h2>
        <p className="tc-p">
          Chúng tôi bảo lưu quyền điều chỉnh giá cho các gói đăng ký theo thời
          gian. Chúng tôi sẽ thông báo trước cho bạn về những thay đổi này. Việc
          bạn tiếp tục sử dụng dịch vụ sau khi thay đổi giá có hiệu lực đồng
          nghĩa với việc bạn chấp nhận mức giá mới.
        </p>
      </section>

      {/* 7 */}
      <section id="tc-sec-7" className="tc-section">
        <h2 className="tc-h2">7. HỦY ĐĂNG KÝ &amp; HOÀN TIỀN</h2>
        <p className="tc-p">
          Tất cả các giao dịch mua là không hoàn lại. Bạn có thể hủy đăng ký của
          mình bất cứ lúc nào trong phần Cài đặt. Việc hủy sẽ có hiệu lực vào
          cuối thời hạn trả phí hiện tại và bạn sẽ tiếp tục có quyền truy cập
          vào các tính năng cao cấp cho đến hết thời hạn đó.
        </p>
      </section>

      {/* 8 */}
      <section id="tc-sec-8" className="tc-section">
        <h2 className="tc-h2">8. CÁC HOẠT ĐỘNG BỊ CẤM</h2>
        <p className="tc-p">
          Bạn không được sử dụng Trang web cho bất kỳ mục đích nào khác ngoài
          mục đích mà chúng tôi cung cấp. Đặc biệt, vì FitMatch là nền tảng kết
          nối người dùng, nghiêm cấm các hành vi:
        </p>
        <ul className="tc-list">
          <li>
            Sử dụng thông tin từ Trang web để quấy rối, lạm dụng, hoặc làm hại
            người khác (bao gồm rình rập, quấy rối tình dục).
          </li>
          <li>
            Thu thập dữ liệu, tên người dùng, email của người dùng khác bằng các
            phương tiện điện tử hoặc tự động.
          </li>
          <li>
            Tải lên hoặc truyền tải virus, Trojan, hoặc các tài liệu gây cản trở
            việc sử dụng của người khác.
          </li>
          <li>Gian lận, đánh lừa chúng tôi hoặc người dùng khác.</li>
          <li>Sử dụng Trang web như một phần của nỗ lực cạnh tranh với chúng tôi.</li>
          <li>
            Xóa thông báo bản quyền hoặc các quyền sở hữu khác khỏi bất kỳ Nội
            dung nào.
          </li>
        </ul>
      </section>

      {/* 9 */}
      <section id="tc-sec-9" className="tc-section">
        <h2 className="tc-h2">
          9. NỘI DUNG DO NGƯỜI DÙNG TẠO (CONTRIBUTIONS)
        </h2>
        <p className="tc-p">
          FitMatch cho phép bạn đăng tải hồ sơ, hình ảnh, chỉ số cơ thể, mục tiêu
          tập luyện (&quot;Đóng góp&quot;). Khi bạn tạo hoặc cung cấp bất kỳ Đóng
          góp nào, bạn tuyên bố và bảo đảm rằng:
        </p>
        <ul className="tc-list">
          <li>
            Đóng góp của bạn không vi phạm quyền sở hữu trí tuệ của bên thứ ba.
          </li>
          <li>
            Bạn là chủ sở hữu hoặc có giấy phép cần thiết để sử dụng và cho phép
            chúng tôi sử dụng Đóng góp của bạn.
          </li>
          <li>
            Đóng góp của bạn không chứa nội dung khiêu dâm, bạo lực, quấy rối,
            bôi nhọ hoặc phản cảm.
          </li>
          <li>
            Đóng góp của bạn không vi phạm bất kỳ luật pháp nào liên quan đến
            bảo vệ trẻ em hoặc phân biệt chủng tộc, giới tính, tôn giáo.
          </li>
        </ul>
      </section>

      {/* 10 */}
      <section id="tc-sec-10" className="tc-section">
        <h2 className="tc-h2">10. GIẤY PHÉP ĐÓNG GÓP</h2>
        <p className="tc-p">
          Bằng cách đăng Đóng góp của bạn lên bất kỳ phần nào của Trang web, bạn
          tự động cấp cho chúng tôi quyền không hạn chế, không giới hạn, không
          thể thu hồi, vĩnh viễn, miễn phí bản quyền, toàn cầu để lưu trữ, sử
          dụng, sao chép, hiển thị công khai, và phân phối các Đóng góp đó (bao
          gồm hình ảnh đại diện và thông tin công khai của bạn) cho mục đích
          vận hành và quảng bá FitMatch.
        </p>
      </section>

      {/* 11 */}
      <section id="tc-sec-11" className="tc-section">
        <h2 className="tc-h2">11. MẠNG XÃ HỘI</h2>
        <p className="tc-p">
          Bạn có thể liên kết tài khoản FitMatch với tài khoản bên thứ ba
          (Facebook, Google...). Bằng cách này, bạn cho phép chúng tôi truy cập
          và lưu trữ nội dung từ Tài khoản Bên thứ ba đó (như danh sách bạn bè,
          ảnh đại diện) để phục vụ tính năng của ứng dụng.
        </p>
      </section>

      {/* 12 */}
      <section id="tc-sec-12" className="tc-section">
        <h2 className="tc-h2">12. QUẢN LÝ TRANG WEB</h2>
        <p className="tc-p">
          Chúng tôi bảo lưu quyền: (1) giám sát Trang web để phát hiện các vi
          phạm; (2) thực hiện hành động pháp lý thích hợp đối với bất kỳ ai vi
          phạm; (3) từ chối, hạn chế truy cập hoặc xóa bất kỳ Đóng góp nào của
          bạn (ví dụ: hình ảnh không phù hợp) mà không cần báo trước.
        </p>
      </section>

      {/* 13 */}
      <section id="tc-sec-13" className="tc-section">
        <h2 className="tc-h2">13. CHÍNH SÁCH BẢO MẬT</h2>
        <p className="tc-p">
          Chúng tôi quan tâm đến quyền riêng tư và bảo mật dữ liệu. Vui lòng xem
          Chính sách Bảo mật của chúng tôi. Bằng cách sử dụng Trang web, bạn
          đồng ý bị ràng buộc bởi Chính sách Bảo mật của chúng tôi. Dữ liệu của
          bạn được xử lý và lưu trữ theo quy định pháp luật.
        </p>
      </section>

      {/* 14 */}
      <section id="tc-sec-14" className="tc-section">
        <h2 className="tc-h2">14. VI PHẠM BẢN QUYỀN</h2>
        <p className="tc-p">
          Chúng tôi tôn trọng quyền sở hữu trí tuệ của người khác. Nếu bạn tin
          rằng bất kỳ tài liệu nào trên FitMatch vi phạm bản quyền bạn sở hữu,
          vui lòng thông báo ngay cho chúng tôi theo thông tin liên hệ bên dưới.
        </p>
      </section>

      {/* 15 */}
      <section id="tc-sec-15" className="tc-section">
        <h2 className="tc-h2">15. SỬA ĐỔI VÀ GIÁN ĐOẠN</h2>
        <p className="tc-p">
          Chúng tôi không đảm bảo Trang web sẽ hoạt động mọi lúc. Chúng tôi có
          thể gặp sự cố phần cứng, phần mềm hoặc cần bảo trì, dẫn đến gián đoạn,
          chậm trễ hoặc lỗi. Chúng tôi có quyền thay đổi, sửa đổi, cập nhật, tạm
          ngừng hoặc ngừng Trang web bất cứ lúc nào mà không cần thông báo cho
          bạn.
        </p>
      </section>

      {/* 16 */}
      <section id="tc-sec-16" className="tc-section">
        <h2 className="tc-h2">16. LUẬT ĐIỀU CHỈNH</h2>
        <p className="tc-p">
          Các Điều khoản này sẽ được điều chỉnh và xác định theo luật pháp của
          Việt Nam (hoặc quốc gia sở tại nơi FitMatch đặt trụ sở chính). Bạn và
          FitMatch đồng ý rằng tòa án tại Việt Nam sẽ có thẩm quyền độc quyền để
          giải quyết mọi tranh chấp phát sinh.
        </p>
      </section>

      {/* 17 */}
      <section id="tc-sec-17" className="tc-section">
        <h2 className="tc-h2">17. GIẢI QUYẾT TRANH CHẤP</h2>
        <p className="tc-p">
          Mọi tranh chấp phát sinh từ hoặc liên quan đến hợp đồng này, bao gồm
          mọi câu hỏi về sự tồn tại, hiệu lực hoặc chấm dứt của nó, trước hết sẽ
          được giải quyết thông qua thương lượng thiện chí. Nếu không thành
          công, tranh chấp sẽ được đưa ra Tòa án có thẩm quyền tại Việt Nam.
        </p>
      </section>

      {/* 18 */}
      <section id="tc-sec-18" className="tc-section">
        <h2 className="tc-h2">18. TỪ CHỐI TRÁCH NHIỆM (QUAN TRỌNG)</h2>
        <p className="tc-p">
          <strong>VỀ Y TẾ:</strong> TRANG WEB ĐƯỢC CUNG CẤP TRÊN CƠ SỞ
          &quot;NGUYÊN TRẠNG&quot;. FITMATCH KHÔNG PHẢI LÀ TỔ CHỨC Y TẾ. CÁC GỢI
          Ý VỀ DINH DƯỠNG VÀ TẬP LUYỆN CHỈ MANG TÍNH THAM KHẢO VÀ KHÔNG THAY THẾ
          CHO LỜI KHUYÊN CỦA BÁC SĨ. BẠN TỰ CHỊU RỦI RO KHI THỰC HIỆN CÁC BÀI
          TẬP.
        </p>
        <p className="tc-p">
          <strong>VỀ KẾT NỐI (MATCHING):</strong> FITMATCH KHÔNG CHỊU TRÁCH
          NHIỆM CHO BẤT KỲ TƯƠNG TÁC NÀO GIỮA BẠN VÀ NGƯỜI DÙNG KHÁC. CHÚNG TÔI
          KHÔNG KIỂM TRA LÝ LỊCH HÌNH SỰ CỦA NGƯỜI DÙNG. BẠN CẦN THẬN TRỌNG KHI
          TƯƠNG TÁC VÀ GẶP GỠ NGƯỜI DÙNG KHÁC NGOÀI ĐỜI THỰC.
        </p>
      </section>

      {/* 19 */}
      <section id="tc-sec-19" className="tc-section">
        <h2 className="tc-h2">19. GIỚI HẠN TRÁCH NHIỆM</h2>
        <p className="tc-p">
          TRONG MỌI TRƯỜNG HỢP, CHÚNG TÔI SẼ KHÔNG CHỊU TRÁCH NHIỆM VỚI BẠN HOẶC
          BẤT KỲ BÊN THỨ BA NÀO VỀ BẤT KỲ THIỆT HẠI TRỰC TIẾP, GIÁN TIẾP, NGẪU
          NHIÊN, ĐẶC BIỆT HOẶC HẬU QUẢ NÀO (BAO GỒM MẤT LỢI NHUẬN, MẤT DỮ LIỆU)
          PHÁT SINH TỪ VIỆC SỬ DỤNG TRANG WEB CỦA BẠN.
        </p>
      </section>

      {/* 20 */}
      <section id="tc-sec-20" className="tc-section">
        <h2 className="tc-h2">20. BỒI THƯỜNG</h2>
        <p className="tc-p">
          Bạn đồng ý bảo vệ, bồi thường và giữ cho chúng tôi (bao gồm các công ty
          con, chi nhánh và nhân viên) không bị tổn hại trước bất kỳ tổn thất,
          thiệt hại, trách nhiệm pháp lý, khiếu nại hoặc yêu cầu nào (bao gồm phí
          luật sư hợp lý) do bên thứ ba đưa ra phát sinh từ: (1) Đóng góp của
          bạn; (2) việc sử dụng Trang web; (3) vi phạm các Điều khoản này; hoặc
          (4) bất kỳ hành động gây hại công khai nào đối với người dùng khác của
          Trang web mà bạn đã kết nối.
        </p>
      </section>

      {/* 21 */}
      <section id="tc-sec-21" className="tc-section">
        <h2 className="tc-h2">21. LIÊN HỆ VỚI CHÚNG TÔI</h2>
        <p className="tc-p">
          Để giải quyết khiếu nại liên quan đến Trang web hoặc để nhận thêm
          thông tin về việc sử dụng Trang web, vui lòng liên hệ với chúng tôi
          tại:
        </p>
        <p className="tc-p">
          <strong>FitMatch Support Team – Email: fitmatchservice@gmail.com</strong>
        </p>
      </section>
    </article>
  );
}
