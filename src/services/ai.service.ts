import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('GEMINI_API_KEY is missing from .env');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = 'gemini-flash-latest';

const systemInstruction = `Bạn là ReMind AI - một chuyên gia tư vấn tâm lý nhẹ nhàng, thấu hiểu và chuyên nghiệp. 
Hãy luôn xưng hô là "Tớ" và gọi người dùng là "Cậu" hoặc "Bạn". 
Nhiệm vụ của bạn là lắng nghe, thấu hiểu, và đưa ra những lời khuyên hữu ích về mặt tâm lý. 
Không đưa ra các chẩn đoán y tế hoặc thay thế bác sĩ.`;

export const generateAIResponse = async (prompt: string, history: any[] = []) => {
  if (!genAI) {
    throw new Error('AI Service is not configured properly (missing API key).');
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  });

  const validHistory: any[] = [];
  let expectedRole = 'user';
  
  for (const msg of history) {
    const role = msg.role === 'ai' || msg.role === 'model' ? 'model' : 'user';
    if (role === expectedRole) {
      validHistory.push({
        role,
        parts: [{ text: msg.text }],
      });
      expectedRole = expectedRole === 'user' ? 'model' : 'user';
    }
  }

  const chat = model.startChat({
    history: validHistory,
  });

  const result = await chat.sendMessage(prompt);
  const responseText = result.response.text();
  return responseText;
};
