# Quince Matrix engine

Build scripts for the daily update. No order data is stored here: the shop data
(state.json) lives inside the owner's private Claude dashboard and is read from it at run time.

    python3 daily.py <export.xlsx> <latest LIVE_ODR workbook.xlsx> [YYYY-MM-DD]

Outputs: quince-matrix.html (private dashboard), site/index.html (this public site),
out/Quince_Matrix_Shop.xlsx and out/LIVE_ODR_QTY - <day>.xlsx.
