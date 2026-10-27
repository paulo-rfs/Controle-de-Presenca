// ============================================================
// CONFIGURACAO DO FIREBASE (VIA REST API)
// ============================================================
let FIREBASE_URL = 'https://presenciometro-escolar-default-rtdb.firebaseio.com';

// Funcao para enviar dados via REST
function enviarParaFirebaseREST(uid, nome, status, tipo) {
  const agora = new Date();
  const dataStr = agora.toLocaleDateString('pt-BR');
  const horaStr = agora.toLocaleTimeString('pt-BR');
  
  const registro = {
    uid: uid,
    nome: nome,
    tipo: tipo || 'DESCONHECIDO',
    data: dataStr,
    hora: horaStr,
    status: status
  };
  
  const id = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const url = FIREBASE_URL + '/registros/' + id + '.json';
  
  console.log('Enviando para Firebase REST:', registro);
  
  return fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registro)
  })
  .then(function(response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  })
  .then(function(data) {
    console.log('Registro enviado! ID:', id);
    return data;
  })
  .catch(function(err) {
    console.error('Erro ao enviar:', err);
    throw err;
  });
}

// ============================================================
// TESTA CONEXAO COM FIREBASE
// ============================================================
function testarConexaoFirebase() {
  const url = FIREBASE_URL + '/.json';
  return fetch(url)
    .then(function(response) {
      if (response.ok) {
        console.log('Firebase conectado!');
        const statusEl = document.getElementById('firebase-status');
        if (statusEl) statusEl.innerHTML = 'Firebase REST conectado!';
        window.firebasePronto = true;
        document.dispatchEvent(new Event('firebase-ready'));
        return true;
      }
      return false;
    })
    .catch(function(err) {
      console.error('Erro:', err);
      return false;
    });
}

testarConexaoFirebase();

// ============================================================
// VARIAVEIS
// ============================================================
let port = null, reader = null, writer = null, keepReading = false, lineBuffer = '';
let logs = [], tags = [], totalAcessos = 0, ultimoAcesso = null, portaAberta = false;

// ============================================================
// DOM ELEMENTOS
// ============================================================
const connectBtn = document.getElementById('connectBtn');
const connectionStatus = document.getElementById('connectionStatus');
const logsBody = document.getElementById('logsBody');
const tagsList = document.getElementById('tagsList');
const totalTags = document.getElementById('totalTags');
const totalAcessosEl = document.getElementById('totalAcessos');
const ultimoAcessoEl = document.getElementById('ultimoAcesso');
const statusPortaEl = document.getElementById('statusPorta');
const togglePortaBtn = document.getElementById('togglePortaBtn');
const addTagBtn = document.getElementById('addTagBtn');
const novaTagUid = document.getElementById('novaTagUid');
const novaTagNome = document.getElementById('novaTagNome');

// ============================================================
// FUNCAO PARA ENVIAR AO FIREBASE
// ============================================================
function enviarParaFirebase(uid, nome, status, tipo) {
  if (!window.firebasePronto) {
    console.warn('Firebase nao disponivel. Registro salvo apenas localmente.');
    return;
  }
  enviarParaFirebaseREST(uid, nome, status, tipo)
    .catch(function(err) {
      console.warn('Falha ao enviar:', err);
    });
}

// ============================================================
// REGISTRA ACESSO
// ============================================================
function registrarAcesso(nome, uid, status, tipo) {
  const agora = new Date();
  const dataStr = agora.toLocaleDateString('pt-BR');
  const horaStr = agora.toLocaleTimeString('pt-BR');

  logs.unshift({ id: logs.length + 1, nome, uid, data: dataStr, hora: horaStr, status, tipo: tipo || 'DESCONHECIDO' });
  totalAcessos++;
  if (logs.length > 100) logs.pop();

  if (status === 'Autorizado') {
    ultimoAcesso = { nome, hora: horaStr, data: dataStr, tipo: tipo || 'DESCONHECIDO' };
  }

  salvarDados();
  atualizarInterface();

  if (status === 'Autorizado' || status === 'Aberto manualmente') {
    enviarParaFirebase(uid, nome, status, tipo);
  }
}

// ============================================================
// ATUALIZA INTERFACE
// ============================================================
function atualizarInterface() {
  if (tags.length === 0) {
    tagsList.innerHTML = '<p style="color: #999;">Nenhum aluno cadastrado</p>';
  } else {
    tagsList.innerHTML = tags.map(t => `
      <div class="tag-item">
        <div class="tag-info">
          <span class="tag-nome"><i class="fas fa-user"></i> ${t.nome}</span>
          <span class="tag-uid">${t.uid}</span>
          <span class="tag-tipo" style="font-size:0.8rem;color:#888;">${t.tipo || 'DESCONHECIDO'}</span>
        </div>
        <button class="btn-remove" onclick="removerTag('${t.uid}')">
          <i class="fas fa-trash"></i> Remover
        </button>
      </div>
    `).join('');
  }

  totalTags.textContent = tags.length;
  totalAcessosEl.textContent = totalAcessos;

  if (ultimoAcesso) {
    ultimoAcessoEl.innerHTML = `
      <p>
        <span class="nome"> ${ultimoAcesso.nome}</span>
        <span class="tipo" style="font-size:0.8rem;color:#888;">(${ultimoAcesso.tipo || 'DESCONHECIDO'})</span><br>
        <span class="hora"> ${ultimoAcesso.data} ${ultimoAcesso.hora}</span>
      </p>
    `;
  } else {
    ultimoAcessoEl.innerHTML = '<p style="color: #999;">Nenhum registro</p>';
  }

  atualizarStatusPorta();
  atualizarLogs();
}

function atualizarStatusPorta() {
  if (portaAberta) {
    statusPortaEl.innerHTML = '<p style="color: #f39c12;"> Porta ABERTA</p>';
    togglePortaBtn.innerHTML = '<i class="fas fa-lock"></i> Fechar Porta';
  } else {
    statusPortaEl.innerHTML = '<p style="color: #2ecc71;"> Porta FECHADA</p>';
    togglePortaBtn.innerHTML = '<i class="fas fa-unlock"></i> Abrir Porta';
  }
}

function atualizarLogs() {
  if (logs.length === 0) {
    logsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhum registro</td></tr>';
    return;
  }
  logsBody.innerHTML = logs.map(log => `
    <tr>
      <td>${log.id}</td>
      <td><strong>${log.nome}</strong> <span style="font-size:0.7rem;color:#888;">(${log.tipo || 'DESCONHECIDO'})</span></td>
      <td style="font-family:monospace;">${log.uid}</td>
      <td>${log.data} ${log.hora}</td>
      <td><span class="status-badge ${log.status === 'Autorizado' ? 'success' : 'danger'}">${log.status}</span></td>
    </tr>
  `).join('');
}

// ============================================================
// PROCESSAR DADOS DO ARDUINO
// ============================================================
function processarDado(linha) {
  console.log('Linha recebida:', linha);

  if (linha.includes('TAG:')) {
    const resto = linha.replace(/^TAG:\s*/, '').trim();
    const partes = resto.split(':').map(p => p.trim());
    
    if (partes.length >= 4) {
      const uid = partes[0];
      const nome = partes[1];
      const tipo = partes[2];
      const status = partes[3].toUpperCase();
      
      console.log('Tag: ' + nome + ' (' + uid + ') - ' + tipo + ' - ' + status);
      
      if (status === 'AUTORIZADO') {
        registrarAcesso(nome, uid, 'Autorizado', tipo);
      } else {
        registrarAcesso('Desconhecido', uid, 'Negado', 'DESCONHECIDO');
      }
    } else if (partes.length >= 3) {
      const uid = partes[0];
      const nome = partes[1];
      const status = partes[2].toUpperCase();
      
      if (status === 'AUTORIZADO') {
        registrarAcesso(nome, uid, 'Autorizado', 'DESCONHECIDO');
      } else {
        registrarAcesso('Desconhecido', uid, 'Negado', 'DESCONHECIDO');
      }
    }
    return;
  }

  if (linha.includes('PORTA:')) {
    const status = linha.replace(/^PORTA:\s*/, '').trim().toUpperCase();
    portaAberta = (status === 'ABERTA');
    atualizarStatusPorta();
    return;
  }

  if (linha.includes('TAG CADASTRADA:')) {
    const resto = linha.replace(/^TAG\s*CADASTRADA:\s*/, '').trim();
    const partes = resto.split(':').map(p => p.trim());
    if (partes.length >= 3) {
      const uid = partes[0];
      const nome = partes[1];
      const tipo = partes[2];
      if (uid && nome && !tags.some(t => t.uid === uid)) {
        tags.push({ uid, nome, tipo: tipo || 'DESCONHECIDO' });
        salvarDados();
        atualizarInterface();
        console.log('Tag adicionada: ' + nome + ' (' + uid + ') - ' + tipo);
      }
    }
    return;
  }
}

// ============================================================
// LEITURA SERIAL
// ============================================================
async function lerDados(readerObj) {
  try {
    while (keepReading) {
      const { value, done } = await readerObj.read();
      if (done) {
        console.log('Leitura finalizada (done=true)');
        break;
      }
      const chunk = new TextDecoder().decode(value, { stream: true });
      lineBuffer += chunk;
      while (lineBuffer.includes('\n')) {
        const idx = lineBuffer.indexOf('\n');
        const line = lineBuffer.substring(0, idx).trim();
        lineBuffer = lineBuffer.substring(idx + 1);
        if (line) processarDado(line);
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Erro na leitura:', error);
    }
  }
  console.log('Leitura finalizada.');
}

// ============================================================
// CONEXAO SERIAL
// ============================================================
async function conectarSerial() {
  try {
    if (port && port.readable) {
      await desconectarSerial();
      return;
    }
    
    console.log('Solicitando porta serial...');
    port = await navigator.serial.requestPort();
    console.log('Porta selecionada, abrindo...');
    
    await port.open({ baudRate: 115200 });
    console.log('Porta aberta!');
    
    console.log('Iniciando leitura...');
    const readerObj = port.readable.getReader();
    reader = readerObj;
    keepReading = true;
    
    lerDados(readerObj);

    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(port.writable);
    writer = textEncoder.writable.getWriter();

    connectBtn.innerHTML = '<i class="fas fa-plug"></i> Desconectar';
    connectBtn.className = 'btn btn-danger';
    connectionStatus.innerHTML = '<i class="fas fa-circle" style="color: #2ecc71;"></i> Conectado ao Arduino';
    togglePortaBtn.disabled = false;
    console.log('Conectado ao Arduino!');
    
  } catch (error) {
    console.error('Erro na conexao:', error);
    connectionStatus.innerHTML = '<i class="fas fa-circle" style="color: #e74c3c;"></i> Erro: ' + error.message;
    await desconectarSerial();
  }
}

async function desconectarSerial() {
  console.log('Desconectando...');
  keepReading = false;
  
  if (reader) {
    try { 
      await reader.cancel(); 
      console.log('Reader cancelado.');
    } catch (e) { console.warn('Erro ao cancelar reader:', e); }
    reader = null;
  }
  
  if (writer) {
    try { 
      await writer.close(); 
      console.log('Writer fechado.');
    } catch (e) { console.warn('Erro ao fechar writer:', e); }
    writer = null;
  }
  
  if (port) {
    try { 
      await port.close(); 
      console.log('Porta fechada.');
    } catch (e) { console.warn('Erro ao fechar porta:', e); }
    port = null;
  }
  
  lineBuffer = '';
  connectBtn.innerHTML = '<i class="fas fa-plug"></i> Conectar ao Arduino';
  connectBtn.className = 'btn btn-success';
  connectionStatus.innerHTML = '<i class="fas fa-circle" style="color: #e74c3c;"></i> Desconectado';
  togglePortaBtn.disabled = true;
  console.log('Desconectado');
}

async function enviarComando(cmd) {
  if (!writer) {
    console.warn('Sem conexao com Arduino.');
    return;
  }
  try { 
    await writer.write(cmd + '\n'); 
    console.log('Comando enviado:', cmd);
  } catch (e) { 
    console.error('Erro ao enviar comando:', e); 
  }
}

async function togglePorta() {
  if (!portaAberta) {
    await enviarComando('ABRIR');
    portaAberta = true;
    atualizarStatusPorta();
    registrarAcesso('Manual', 'Manual', 'Aberto manualmente', 'SISTEMA');
  } else {
    await enviarComando('FECHAR');
    portaAberta = false;
    atualizarStatusPorta();
  }
}

function adicionarTag() {
  const uid = novaTagUid.value.trim().toUpperCase();
  const nome = novaTagNome.value.trim();
  if (!uid || !nome) { alert('Preencha ambos!'); return; }
  if (tags.some(t => t.uid === uid)) { alert('Tag ja existe!'); return; }
  tags.push({ uid, nome, tipo: 'CADASTRADO' });
  salvarDados();
  atualizarInterface();
  novaTagUid.value = '';
  novaTagNome.value = '';
  enviarComando('ADD ' + uid + ' ' + nome);
  alert('Tag ' + nome + ' cadastrado!');
}

function removerTag(uid) {
  const nome = tags.find(t => t.uid === uid)?.nome;
  if (!confirm('Remover ' + nome + '?')) return;
  tags = tags.filter(t => t.uid !== uid);
  salvarDados();
  atualizarInterface();
  enviarComando('REM ' + uid);
}

function salvarDados() {
  try {
    localStorage.setItem('rfid_dashboard', JSON.stringify({ tags, logs: logs.slice(0, 50), totalAcessos, ultimoAcesso }));
  } catch (e) { console.warn('Erro ao salvar:', e); }
}

function carregarDados() {
  try {
    const dados = JSON.parse(localStorage.getItem('rfid_dashboard'));
    if (dados) {
      tags = dados.tags || [];
      logs = dados.logs || [];
      totalAcessos = dados.totalAcessos || 0;
      ultimoAcesso = dados.ultimoAcesso || null;
    }
  } catch (e) { console.warn('Erro ao carregar:', e); }
}

// ============================================================
// LIMPAR BANCO DE DADOS (FIREBASE - NUVEM)
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const limparFirebaseBtn = document.getElementById('limparFirebaseBtn');
    
    if (limparFirebaseBtn) {
        limparFirebaseBtn.addEventListener('click', function() {
            if (confirm('ATENCAO! Deseja limpar TODOS os registros do Firebase?\n\nIsso vai apagar os dados da NUVEM para TODOS os usuarios.\n\nEsta acao NAO pode ser desfeita!')) {
                if (confirm('ULTIMA CHANCE! Deseja realmente apagar TODOS os registros do banco de dados?\n\nIsso afeta todos os usuarios do sistema.')) {
                    var confirmacao = prompt('Digite "SIM" para confirmar a exclusao de todos os registros:');
                    if (confirmacao === 'SIM') {
                        try {
                            const url = FIREBASE_URL + '/registros.json';
                            
                            console.log('Apagando todos os registros do Firebase...');
                            
                            const btn = limparFirebaseBtn;
                            const originalText = btn.innerHTML;
                            btn.innerHTML = 'Apagando...';
                            btn.disabled = true;
                            
                            fetch(url, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' }
                            })
                            .then(function(response) {
                                if (!response.ok) throw new Error('HTTP ' + response.status);
                                return response.json();
                            })
                            .then(function(data) {
                                console.log('Banco de dados limpo com sucesso!');
                                alert('Todos os registros foram removidos do Firebase!');
                                localStorage.removeItem('rfid_dashboard');
                                location.reload();
                            })
                            .catch(function(err) {
                                console.error('Erro ao limpar Firebase:', err);
                                alert('Erro ao limpar o banco de dados: ' + err.message);
                                btn.innerHTML = originalText;
                                btn.disabled = false;
                            });
                            
                        } catch (e) {
                            console.error('Erro:', e);
                            alert('Erro ao limpar banco: ' + e.message);
                        }
                    } else {
                        alert('Confirmacao cancelada. Digite "SIM" para confirmar.');
                    }
                }
            }
        });
    }
});

// ============================================================
// INICIALIZACAO
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  if (!('serial' in navigator)) {
    connectionStatus.innerHTML = 'Navegador nao suporta Web Serial. Use Chrome/Edge.';
    connectBtn.disabled = true;
    return;
  }
  
  carregarDados();
  atualizarInterface();
  connectBtn.addEventListener('click', conectarSerial);
  togglePortaBtn.addEventListener('click', togglePorta);
  addTagBtn.addEventListener('click', adicionarTag);

  document.getElementById('limparLogsBtn')?.addEventListener('click', function() {
    if (confirm('Tem certeza que deseja limpar todo o historico?')) {
      if (confirm('Ultima chance! Deseja realmente apagar todos os registros?')) {
        logs = [];
        totalAcessos = 0;
        ultimoAcesso = null;
        salvarDados();
        atualizarInterface();
        console.log('Historico limpo!');
      }
    }
  });

  console.log('Sistema pronto!');
  console.log('Gabriel - ALUNO (A3 77 2B 14)');
  console.log('Paulo - FUNCIONARIO (E3 FB DF 2F)');
});
