import mongoose from "mongoose";

const ContactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      // Đảm bảo đúng đuôi @gmail.com
      match: [/^[^@\s]+@gmail\.com$/i, "Email phải có đuôi @gmail.com"],
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 11,
      // Chỉ chữ số, tối đa 11 số
      match: [/^\d{1,11}$/, "Số điện thoại chỉ gồm số và tối đa 11 số"],
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    status: {
      type: String,
      enum: ["new", "processing", "done"],
      default: "new", // Mới gửi
    },
    internalNote: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
    },
  },
  {
    timestamps: true,
  }
);

const ContactMessage = mongoose.model("ContactMessage", ContactMessageSchema);
export default ContactMessage;
