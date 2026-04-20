// OpenRouter AI Service - replaces geminiService
// Uses OpenRouter's chat completions API with vision-capable models

const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY ||
  (typeof process !== 'undefined' && process.env?.VITE_OPENROUTER_API_KEY) || "";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Default vision model - can be changed to any vision-capable model on OpenRouter
const VISION_MODEL = "google/gemini-2.0-flash-lite-001";

export interface ValidationResult {
  isValid: boolean;
  detectedWeight: number | null;
  confidence: number;
  reason: string;
}

async function callOpenRouter(messages: any[], model: string = VISION_MODEL): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "CarnesTrace - Meat Traceability System",
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "{}";
}

export async function validateWeightWithAI(imageBase64: string, expectedWeight: number): Promise<ValidationResult> {
  if (!apiKey || apiKey === "undefined" || apiKey === "" || apiKey === "null") {
    console.warn("OPENROUTER_API_KEY not found. AI validation is disabled.");
    return {
      isValid: false,
      detectedWeight: null,
      confidence: 0,
      reason: "ERROR: No se ha detectado la clave de API de OpenRouter. Por favor, asegúrese de configurarla en las variables de entorno como VITE_OPENROUTER_API_KEY."
    };
  }

  try {
    // Ensure proper base64 data URL format
    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const prompt = `TAREA CRÍTICA: Eres un auditor de calidad en una planta cárnica. 
    Tu trabajo es VALIDAR que el peso físico mostrado en la báscula coincide con el peso registrado por el operador.
    
    REGLAS DE VALIDACIÓN:
    1. DEBE haber una pieza de carne real visible.
    2. DEBE haber una báscula (digital o analógica) visible.
    3. El peso en la báscula DEBE ser legible.
    4. El peso detectado debe estar cerca de ${expectedWeight} kg (margen de error aceptable: 5%).
    
    Si NO ves carne, o NO ves una báscula, o la foto es de otra cosa (como el piso, una pared, una persona), debes marcar isValid como FALSE.
    
    RESPUESTA JSON OBLIGATORIA:
    {
      "detectedWeight": número (el peso que tú ves en la báscula en kg),
      "isMeatPresent": booleano,
      "isScalePresent": booleano,
      "confidence": número (0 a 1),
      "reason": "string breve en español explicando tu decisión"
    }`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ];

    const responseText = await callOpenRouter(messages);
    const data = JSON.parse(responseText);

    // Tolerance of 5% or 0.1kg
    const detectedWeight = data.detectedWeight || 0;
    const diff = Math.abs(detectedWeight - expectedWeight);
    const isWeightMatch = diff <= Math.max(0.1, expectedWeight * 0.05);

    const isValid = isWeightMatch && data.isMeatPresent && data.isScalePresent;

    return {
      isValid: isValid,
      detectedWeight: detectedWeight,
      confidence: data.confidence || 0,
      reason: data.reason || "Análisis completado."
    };
  } catch (error) {
    console.error("OpenRouter AI Error:", error);
    return {
      isValid: false,
      detectedWeight: null,
      confidence: 0,
      reason: "Error técnico al procesar la imagen con la IA. Por favor, intente de nuevo o contacte a soporte."
    };
  }
}

export interface ExtractedProduct {
  nombre: string;
  cantidad: number;
  unidad: string;
}

export async function extractProductsFromImage(imageBase64: string): Promise<ExtractedProduct[]> {
  if (!apiKey || apiKey === "undefined" || apiKey === "" || apiKey === "null") {
    console.warn("OPENROUTER_API_KEY not found. AI extraction is disabled.");
    return [];
  }

  try {
    // Ensure proper base64 data URL format
    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const prompt = `Analiza esta imagen de una lista de producción de alimentos.
              Identifica los productos preparados y sus cantidades.
              
              Reglas estrictas:
              1. Devuelve un objeto JSON con la clave "products" que contiene una lista de objetos.
              2. Formato de cada objeto: {"nombre": "PREPARADO", "cantidad": valor_numerico, "unidad": "unidad"}.
              3. Unidades permitidas: kg, g, unidades, lts, potes, paquetes.
              4. Ejemplo de salida: {"products": [{"nombre": "Salsa Boloñesa", "cantidad": 2, "unidad": "kg"}]}.
              5. Solo devuelve JSON válido, sin bloques de código markdown ni texto adicional.`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ];

    const responseText = await callOpenRouter(messages);
    const data = JSON.parse(responseText);

    // Handle both array and {products: [...]} formats
    const products = Array.isArray(data) ? data : (data.products || []);

    if (Array.isArray(products)) {
      return products.map((item: any) => ({
        nombre: item.nombre || "Preparado desconocido",
        cantidad: parseFloat(item.cantidad) || 1,
        unidad: item.unidad || "unidades"
      }));
    }
    return [];
  } catch (error) {
    console.error("OpenRouter AI Extraction Error:", error);
    return [];
  }
}
