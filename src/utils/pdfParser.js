import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// 设置 worker 路径
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * 从 PDF 文件中提取文本内容
 * @param {File} file - PDF 文件对象
 * @returns {Promise<string>} - 提取的文本内容
 */
export async function extractTextFromPDF(file) {
  try {
    console.log('📖 开始解析 PDF...');
    
    // 将文件转换为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log(`📦 文件大小: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);
    
    // 加载 PDF 文档
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`📄 PDF 总页数: ${pdf.numPages}`);
    
    let fullText = '';
    
    // 遍历所有页面
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // 提取文本项
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      
      fullText += `\n--- 第 ${pageNum} 页 ---\n${pageText}\n`;
      
      if (pageNum % 10 === 0) {
        console.log(`⏳ 已处理 ${pageNum}/${pdf.numPages} 页...`);
      }
    }
    
    console.log(`✅ PDF 解析完成，提取了 ${fullText.length} 个字符`);
    return fullText;
  } catch (error) {
    console.error('❌ PDF 解析错误:', error);
    throw new Error(`无法解析 PDF 文件: ${error.message}`);
  }
}

/**
 * 从 DOCX 文件中提取文本内容
 * @param {File} file - DOCX 文件对象
 * @returns {Promise<string>} - 提取的文本内容
 */
export async function extractTextFromDOCX(file) {
  try {
    console.log('📝 开始解析 DOCX...');
    
    // 将文件转换为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log(`📦 文件大小: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);
    
    // 使用 mammoth 提取文本
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    console.log(`✅ DOCX 解析完成，提取了 ${result.value.length} 个字符`);
    
    if (result.messages.length > 0) {
      console.warn('⚠️ DOCX 解析警告:', result.messages);
    }
    
    return result.value;
  } catch (error) {
    console.error('❌ DOCX 解析错误:', error);
    throw new Error(`无法解析 DOCX 文件: ${error.message}`);
  }
}

/**
 * 从文件中提取文本内容（支持多种格式）
 * @param {File} file - 文件对象
 * @returns {Promise<string>} - 提取的文本内容
 */
export async function extractTextFromFile(file) {
  const fileName = file.name.toLowerCase();
  
  // PDF 文件
  if (fileName.endsWith('.pdf')) {
    return await extractTextFromPDF(file);
  }
  
  // DOCX 文件
  if (fileName.endsWith('.docx')) {
    return await extractTextFromDOCX(file);
  }
  
  // DOC 文件（旧格式，不支持）
  if (fileName.endsWith('.doc')) {
    throw new Error('不支持 .doc 格式，请将文件另存为 .docx 或 .pdf 格式');
  }
  
  // 文本文件（TXT, MD, 等）
  if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    return await file.text();
  }
  
  // 默认作为文本读取
  return await file.text();
}
