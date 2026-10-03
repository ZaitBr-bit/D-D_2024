// ============================================================
// Autenticacao Firebase (Google Sign-In) + Firestore
// Modulo opcional: se nao logado, tudo funciona via localStorage
// ============================================================

// Configuracao do projeto Firebase (produção)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBlk6l-yuMQpC080fOsN4NC4mB5pbyY7VA",
  authDomain: "ded2024.firebaseapp.com",
  projectId: "ded2024",
  storageBucket: "ded2024.firebasestorage.app",
  messagingSenderId: "360073497668",
  appId: "1:360073497668:web:34377bc83947cbb7018011",
  measurementId: "G-RET2BV4Z36"
};

let _app = null;
let _auth = null;
let _db = null;
let _usuario = null;
let _inicializado = false;
let _onAuthChangeCallbacks = [];

/**
 * Inicializa o Firebase de forma lazy (apenas quando necessario).
 * Carrega os scripts via importmap compat (ESM CDN).
 */
async function inicializarFirebase() {
  if (_inicializado) return;
  try {
    // Importar Firebase App
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js');
    const { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } =
      await import('https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js');
    const { getFirestore } =
      await import('https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js');

    _app = initializeApp(FIREBASE_CONFIG);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    _inicializado = true;

    // Escutar mudancas de autenticacao
    onAuthStateChanged(_auth, (user) => {
      _usuario = user || null;
      _onAuthChangeCallbacks.forEach(cb => cb(_usuario));
    });
  } catch (err) {
    console.warn('Firebase nao disponivel (offline ou bloqueado):', err.message);
    _inicializado = false;
  }
}

/** Registra callback para mudanca de estado de autenticacao */
export function onAuthChange(callback) {
  _onAuthChangeCallbacks.push(callback);
  // Se ja inicializado, dispara imediatamente com estado atual
  if (_inicializado) callback(_usuario);
}

/** Retorna o usuario logado ou null */
export function getUsuario() {
  return _usuario;
}

/** Retorna true se o Firebase foi inicializado com sucesso */
export function firebaseDisponivel() {
  return _inicializado;
}

/** Login com Google via popup */
export async function loginComGoogle() {
  await inicializarFirebase();
  if (!_auth) throw new Error('Firebase nao inicializado');
  const { signInWithPopup, GoogleAuthProvider } =
    await import('https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(_auth, provider);
  return result.user;
}

/** Logout */
export async function logout() {
  if (!_auth) return;
  const { signOut } = await import('https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js');
  await signOut(_auth);
  _usuario = null;
}

/** Inicializa Firebase em segundo plano (chamado no boot da app) */
export async function iniciarAuth() {
  await inicializarFirebase();
}

// ============================================================
// Operacoes Firestore para personagens
// ============================================================

async function _getFirestoreModules() {
  return import('https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js');
}

/**
 * Retorna a referencia da colecao de personagens do usuario logado.
 * Caminho: users/{uid}/personagens
 */
function _colecaoPath() {
  if (!_usuario) return null;
  return `users/${_usuario.uid}/personagens`;
}

/** Lista todos os personagens do Firestore */
export async function listarPersonagensCloud() {
  if (!_db || !_usuario) return [];
  const { collection, getDocs } = await _getFirestoreModules();
  const ref = collection(_db, _colecaoPath());
  const snap = await getDocs(ref);
  return snap.docs.map(doc => ({ ...doc.data(), _docId: doc.id }));
}

/** Salva ou atualiza um personagem no Firestore */
export async function salvarPersonagemCloud(personagem) {
  if (!_db || !_usuario) return;
  const { doc, setDoc } = await _getFirestoreModules();
  // Usar o id do personagem como docId para facil lookup
  const docRef = doc(_db, _colecaoPath(), personagem.id);
  // Remover campos undefined que o Firestore nao aceita
  const dados = JSON.parse(JSON.stringify(personagem));
  await setDoc(docRef, dados);
}

/**
 * Registra a exclusão de um personagem na nuvem como lápide no mesmo
 * documento (não apaga o documento): outros aparelhos que ainda têm a cópia
 * local passam a saber que ele foi excluído, em vez de recriá-lo.
 */
export async function removerPersonagemCloud(id) {
  if (!_db || !_usuario) return;
  const { doc, setDoc } = await _getFirestoreModules();
  const docRef = doc(_db, _colecaoPath(), id);
  const agora = new Date().toISOString();
  await setDoc(docRef, { id, removido: true, removido_em: agora, atualizado_em: agora });
}

/**
 * Busca todos os documentos de personagens da nuvem, lápides incluídas.
 * Usado pela reconciliação (sync-merge.js).
 */
export async function buscarEstadoCloud() {
  if (!_db || !_usuario) return [];
  const lista = await listarPersonagensCloud();
  // Remover metadado _docId do Firestore
  return lista.map(({ _docId, ...sem }) => sem);
}

/**
 * Busca o documento de UM personagem na nuvem (personagem ou lápide).
 * @param {string} id
 * @returns {Promise<object|null>} null se não existe, não há login ou o Firebase não está disponível.
 */
export async function buscarPersonagemCloud(id) {
  if (!_db || !_usuario) return null;
  const { doc, getDoc } = await _getFirestoreModules();
  const snap = await getDoc(doc(_db, _colecaoPath(), id));
  return snap.exists() ? snap.data() : null;
}

/**
 * Busca personagens da nuvem (Firestore), sem as lápides de exclusão.
 * Os personagens locais sao tratados separadamente (backup/restore).
 */
export async function buscarPersonagensCloud() {
  return (await buscarEstadoCloud()).filter(p => p.removido !== true);
}
