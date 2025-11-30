// admin-app/src/utils/foodTemplateExcel.js
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const FOOD_COLUMNS = [
  { key: "imageUrl", header: "Hình ảnh (URL)", width: 30, note: "Link hình ảnh món ăn (tuỳ chọn)" },
  { key: "name", header: "Tên món ăn *", width: 28, required: true, note: "Bắt buộc, tối đa 100 ký tự" },
  { key: "servingDesc", header: "Khẩu phần", width: 20, note: "Ví dụ: 1 đĩa, 1 chén..." },
  { key: "massG", header: "Khối lượng *", width: 14, required: true, format: "number", note: "Bắt buộc, > 0, đơn vị g hoặc ml" },
  { key: "unit", header: "Đơn vị *", width: 12, required: true, note: "Chỉ 'g' hoặc 'ml'" },
  { key: "kcal", header: "Calorie (kcal) *", width: 16, required: true, format: "number", note: "Bắt buộc, >= 0" },
  { key: "proteinG", header: "Đạm (g)", width: 14, format: "number", note: ">= 0 (tuỳ chọn)" },
  { key: "carbG", header: "Đường bột (g)", width: 16, format: "number", note: ">= 0 (tuỳ chọn)" },
  { key: "fatG", header: "Chất béo (g)", width: 14, format: "number", note: ">= 0 (tuỳ chọn)" },
  { key: "saltG", header: "Muối (g)", width: 14, format: "number", note: ">= 0 (tuỳ chọn)" },
  { key: "sugarG", header: "Đường (g)", width: 14, format: "number", note: ">= 0 (tuỳ chọn)" },
  { key: "fiberG", header: "Chất xơ (g)", width: 14, format: "number", note: ">= 0 (tuỳ chọn)" },
  { key: "description", header: "Mô tả", width: 40, note: "Mô tả chi tiết món ăn (tuỳ chọn)" },
];

// helper để convert index -> A,B,C...
const getColumnLetter = (colNumber) => {
  let letter = "";
  while (colNumber >= 0) {
    letter = String.fromCharCode((colNumber % 26) + 65) + letter;
    colNumber = Math.floor(colNumber / 26) - 1;
  }
  return letter;
};

export const downloadFoodTemplateExcel = async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Danh sách món ăn", {
    pageSetup: { paperSize: 9, orientation: "portrait" },
    properties: { defaultRowHeight: 18 },
  });

  // ========== TITLE ==========
  sheet.mergeCells("A1:M1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "Danh sách món ăn";
  titleCell.font = { name: "Times New Roman", bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  sheet.addRow([]); // hàng trống (row 2)

  // ========== HEADER (row 3) ==========
  const headerRow = sheet.addRow(FOOD_COLUMNS.map((c) => c.header));

  headerRow.eachCell((cell, colNumber) => {
    const col = FOOD_COLUMNS[colNumber - 1];
    cell.font = {
      name: "Times New Roman",
      size: 11,
      bold: true,
      color: col.required ? { argb: "FFFF0000" } : { argb: "FF000000" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "a7e2b9" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    // set width
    sheet.getColumn(colNumber).width = col.width || 15;

    // note mô tả validate
    if (col.note) {
      cell.note = col.note;
    }
  });

  // ========== GRID cho 50 dòng dữ liệu ==========
  const TEMPLATE_ROWS = 50;
  const START_ROW = 4; // sau header
  const LAST_ROW = START_ROW + TEMPLATE_ROWS - 1; // 4..53

  for (let rowIndex = START_ROW; rowIndex <= LAST_ROW; rowIndex++) {
    const row = sheet.addRow(new Array(FOOD_COLUMNS.length).fill(""));
    row.eachCell((cell, colNumber) => {
      const colDef = FOOD_COLUMNS[colNumber - 1];
      cell.font = { name: "Times New Roman", size: 11 };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = {
        horizontal: colDef?.format === "number" ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
    });
  }

  // ========== Data validation cho cột Unit (g/ml) ==========
  const unitColIndex = FOOD_COLUMNS.findIndex((c) => c.key === "unit");
  if (unitColIndex >= 0) {
    const letter = getColumnLetter(unitColIndex); // 0-based -> letter (A,B,...)
    for (let r = START_ROW; r <= LAST_ROW; r++) {
      const cell = sheet.getCell(`${letter}${r}`);
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"g,ml"'],
        showErrorMessage: true,
        errorTitle: "Lỗi nhập liệu",
        error: "Đơn vị chỉ được nhập 'g' hoặc 'ml'",
      };
    }
  }

  // Freeze header (tới row 3)
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, "Danh_sach_mon_an_template.xlsx");
};
