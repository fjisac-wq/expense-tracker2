import React, { useState, useRef, useEffect } from 'react';
import { Copy, Mic, Camera, Image as ImageIcon, Send, RotateCcw, Download } from 'lucide-react';

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState([]);
  const [messages, setMessages] = useState([
    { role: 'system', text: '¡Hola! Sube foto, dicta o escribe un gasto.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.continuous = false;

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);

      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          processVoiceInput(transcript);
        }
      };

      recognitionRef.current.onerror = () => {
        addMessage('❌ No se detectó sonido. Intenta de nuevo.', 'system');
      };
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Convert Spanish text numbers to digits
  const textToNumber = (text) => {
    const numberMap = {
      cero: '0', uno: '1', dos: '2', tres: '3', cuatro: '4',
      cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
      diez: '10', once: '11', doce: '12', trece: '13', catorce: '14',
      quince: '15', dieciséis: '16', diecisiete: '17', dieciocho: '18', diecinueve: '19',
      veinte: '20', treinta: '30', cuarenta: '40', cincuenta: '50',
      sesenta: '60', setenta: '70', ochenta: '80', noventa: '90'
    };

    let result = text.toLowerCase();
    Object.entries(numberMap).forEach(([word, num]) => {
      result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
    });

    // Handle compound numbers like "veintinueve"
    result = result.replace(/veinti(\d)/g, (match, digit) => String(20 + parseInt(digit)));
    result = result.replace(/treinta y (\d)/g, (match, digit) => String(30 + parseInt(digit)));
    result = result.replace(/cuarenta y (\d)/g, (match, digit) => String(40 + parseInt(digit)));

    return result;
  };

  // Process voice input
  const processVoiceInput = (transcript) => {
    addMessage(transcript, 'user');
    
    const lowerTranscript = transcript.toLowerCase();
    
    // Find the word "importe"
    if (!lowerTranscript.includes('importe')) {
      addMessage('❌ Formato: [Concepto] importe [Importe] [Sección]', 'system');
      return;
    }

    // Split by "importe"
    const parts = lowerTranscript.split('importe');
    const concept = parts[0].trim();
    const rest = parts[1].trim();

    // Convert text numbers
    const convertedRest = textToNumber(rest);

    // Extract number and section
    const numberMatch = convertedRest.match(/(\d+[.,]\d+|\d+)/);
    if (!numberMatch) {
      addMessage('❌ El importe debe ser un número válido', 'system');
      return;
    }

    const amount = numberMatch[0].replace(',', '.');
    const section = convertedRest.replace(numberMatch[0], '').trim();

    if (!section) {
      addMessage('❌ Agrégale una sección al gasto', 'system');
      return;
    }

    addExpense(concept, amount, section);
  };

  // Add message to chat
  const addMessage = (text, role = 'user') => {
    setMessages(prev => [...prev, { role, text }]);
  };

  // Add expense to list
  const addExpense = (concept, amount, section, store = null, invoiceCode = null) => {
    const today = new Date().toISOString().split('T')[0];
    const monthNum = new Date().getMonth() + 1;
    const yearMonth = parseInt(`${new Date().getFullYear()}${String(monthNum).padStart(2, '0')}`);

    const expense = {
      date: today,
      concept: store ? 'Super' : concept,
      amount: parseFloat(amount),
      group: store || 'Gasto',
      saldo: 0,
      mes: yearMonth,
      section: section.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''),
      invoice: invoiceCode || '-',
      monthNum: monthNum
    };

    setExpenses(prev => [...prev, expense]);

    if (store) {
      addMessage(`✅ Ticket: ${store} - ${amount}€`, 'system');
    } else {
      addMessage(`✅ Gasto: ${concept} - ${amount}€`, 'system');
    }
  };

  // Process text input
  const processTextInput = (text) => {
    const trimmed = text.trim().toLowerCase();

    if (trimmed === 'reseteo') {
      setExpenses([]);
      addMessage('🔄 Resetado', 'system');
      return;
    }

    if (trimmed === 'total') {
      addMessage('📊 Resumen generado', 'system');
      return;
    }

    // Check if it's a ticket command
    if (trimmed.startsWith('ticket ')) {
      const parts = trimmed.replace('ticket ', '').split(' ');
      if (parts.length >= 3) {
        const store = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        const amount = parts[1];
        const code = parts.slice(2).join(' ');
        addExpense(null, amount, 'Compra', store, code);
      } else {
        addMessage('❌ Formato: ticket [tienda] [total] [código]', 'system');
      }
      return;
    }

    // Parse expense: concept amount section
    const parts = text.trim().split(' ');
    if (parts.length >= 3) {
      const amount = parts[parts.length - 2];
      const section = parts[parts.length - 1];
      const concept = parts.slice(0, -2).join(' ');

      if (!isNaN(amount.replace(',', '.'))) {
        addExpense(concept, amount.replace(',', '.'), section);
        return;
      }
    }

    addMessage('📌 Formato: [Concepto] [Importe] [Sección] o ticket [tienda] [total] [código]', 'system');
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    addMessage(inputText, 'user');
    processTextInput(inputText);
    setInputText('');
  };

  // Handle camera/gallery upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result);
        // Simulate ticket data
        const store = ['Mercadona', 'Carrefour', 'Alcampo'][Math.floor(Math.random() * 3)];
        const amount = (Math.random() * 50 + 10).toFixed(2);
        const code = `INV${Math.floor(Math.random() * 9000) + 1000}`;
        addMessage(`📸 Ticket detectado de ${store}`, 'system');
        addExpense(null, amount, 'Compra', store, code);
      };
      reader.readAsDataURL(file);
    }
  };

  // Copy to clipboard
  const copyToExcel = () => {
    if (expenses.length === 0) {
      addMessage('❌ Agrega datos primero', 'system');
      return;
    }

    let table = expenses
      .map(e => `${e.date}\t${e.concept}\t-${e.amount.toString().replace('.', ',')}\t${e.group}\t${e.saldo}\t${e.mes}\t${e.section}\t${e.invoice}\t${e.monthNum}`)
      .join('\n');

    navigator.clipboard.writeText(table);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Grouped table
  const groupedByInvoice = expenses.reduce((acc, exp) => {
    if (!acc[exp.invoice]) acc[exp.invoice] = [];
    acc[exp.invoice].push(exp);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '30px', textAlign: 'center', color: 'white' }}>
          <h1 style={{ fontSize: '2.5em', marginBottom: '10px', fontWeight: '700' }}>💰 Expense Tracker</h1>
          <p style={{ fontSize: '1.1em', opacity: 0.9 }}>Gestor de gastos inteligente</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth > 1024 ? '1fr 1fr' : '1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Input Panel */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ fontSize: '1.3em', marginBottom: '20px', color: '#333' }}>📥 Entrada de Datos</h2>

            {/* Camera/Gallery Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <button
                onClick={() => cameraInputRef.current?.click()}
                style={{
                  padding: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9em',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Camera size={18} /> Cámara
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9em',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <ImageIcon size={18} /> Galería
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />

            {uploadedImage && (
              <div style={{ marginBottom: '20px' }}>
                <img src={uploadedImage} alt="Ticket" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '200px' }} />
              </div>
            )}

            {/* Mic Button */}
            <button
              onClick={() => recognitionRef.current?.start()}
              disabled={isListening}
              style={{
                width: '100%',
                padding: '14px',
                background: isListening ? '#999' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isListening ? 'not-allowed' : 'pointer',
                fontSize: '1em',
                fontWeight: '600',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Mic size={20} /> {isListening ? 'Escuchando...' : 'Dictar Gasto'}
            </button>

            {/* Manual Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.9em', color: '#666', marginBottom: '8px', display: 'block' }}>
                Insertar Gasto Manualmente
              </label>
              <input
                type="text"
                placeholder="Ej: Farmacia 15.99 Medicinas"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '1em',
                  marginBottom: '10px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={() => {
                  processTextInput(inputText);
                  setInputText('');
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Insert
              </button>
            </div>

            {/* Info Box */}
            <div style={{
              background: '#f5f5f5',
              padding: '14px',
              borderRadius: '8px',
              fontSize: '0.85em',
              color: '#666',
              lineHeight: '1.6'
            }}>
              <strong>📌 Formatos válidos:</strong><br />
              • Dictar: "Gasolina importe 25.50 Combustible"<br />
              • Escribir: "Gasolina 25.50 Combustible"<br />
              • Ticket: "ticket Mercadona 45.99 INV001"<br />
              • "total" para ver resumen<br />
              • "reseteo" para empezar
            </div>
          </div>

          {/* Chat Panel */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            height: '500px'
          }}>
            <h2 style={{ fontSize: '1.3em', marginBottom: '20px', color: '#333' }}>💬 Chat</h2>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '16px',
              paddingRight: '8px'
            }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : '#e8e8e8',
                      color: msg.role === 'user' ? 'white' : '#333',
                      wordBreak: 'break-word'
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Escribe comando..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '0.95em'
                }}
              />
              <button
                onClick={handleSendMessage}
                style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Table Section */}
        {expenses.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3em', color: '#333' }}>📊 Resumen de Gastos</h2>
              <button
                onClick={copyToExcel}
                style={{
                  padding: '10px 16px',
                  background: copied ? '#4caf50' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Copy size={18} /> {copied ? '✅ Copiado' : '📋 Copy for Excel'}
              </button>
            </div>

            {/* Main Table */}
            <div style={{ overflowX: 'auto', marginBottom: '30px' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9em'
              }}>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '10px', textAlign: 'left' }}>{e.date}</td>
                      <td style={{ padding: '10px' }}>{e.concept}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>-{e.amount.toString().replace('.', ',')}</td>
                      <td style={{ padding: '10px' }}>{e.group}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{e.saldo}</td>
                      <td style={{ padding: '10px' }}>{e.mes}</td>
                      <td style={{ padding: '10px' }}>{e.section}</td>
                      <td style={{ padding: '10px' }}>{e.invoice}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{e.monthNum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grouped Table */}
            <h3 style={{ fontSize: '1.1em', marginBottom: '16px', color: '#333' }}>Agrupado por Factura</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9em'
              }}>
                <tbody>
                  {Object.entries(groupedByInvoice).map(([invoice, items]) => (
                    <React.Fragment key={invoice}>
                      {items.map((e, i) => (
                        <tr key={`${invoice}-${i}`} style={{ borderBottom: '1px solid #e0e0e0', background: i === 0 ? '#f9f9f9' : 'white' }}>
                          <td style={{ padding: '10px' }}>{e.date}</td>
                          <td style={{ padding: '10px' }}>{e.concept}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>-{e.amount.toString().replace('.', ',')}</td>
                          <td style={{ padding: '10px' }}>{e.group}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{e.saldo}</td>
                          <td style={{ padding: '10px' }}>{e.mes}</td>
                          <td style={{ padding: '10px' }}>{e.section}</td>
                          <td style={{ padding: '10px', fontWeight: i === 0 ? '600' : '400' }}>{e.invoice}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{e.monthNum}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {expenses.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setExpenses([]);
                setMessages([{ role: 'system', text: '🔄 Resetado' }]);
              }}
              style={{
                padding: '12px 20px',
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <RotateCcw size={18} /> Resetear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
