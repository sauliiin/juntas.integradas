// Importar funções do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getFirestore, collection, doc, getDocs, getDoc, 
    addDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, orderBy, query, writeBatch
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// --- Configuração do Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyDM66hHUOkfAP3FrnfcQaF2aRiY_2jhnTM",
    authDomain: "controle-de-ferias-45d25.firebaseapp.com",
    projectId: "controle-de-ferias-45d25",
    storageBucket: "controle-de-ferias-45d25.appspot.com",
    messagingSenderId: "298345781850",
    appId: "1:298345781850:web:0d21bb20a7fad821de9663"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Referências das Coleções ---
// 1ª Instância
const juntasRef = collection(db, "juntas");
const suplentes1Ref = collection(db, "suplentes"); // Mantido como 'suplentes'
const portariasRef = collection(db, "portarias");
// 2ª Instância (NOVAS)
const camarasRef = collection(db, "camaras");
const suplentes2Ref = collection(db, "suplentes2");
const atosRef = collection(db, "atos");


// Estado Global
let currentUser = null;
let pendingAction = null; 

// --- LÓGICA DE AUTENTICAÇÃO ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.body.classList.add("logged-in");
    } else {
        currentUser = null;
        document.body.classList.remove("logged-in");
    }
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const senha = document.getElementById("loginSenha").value;
    const errorEl = document.getElementById("loginError");
    
    errorEl.style.display = "none";

    if (email.toLowerCase() !== "mestre@yoda.com" || senha !== "mestre@yoda") {
        errorEl.style.display = "block";
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, "mestre@yoda.com", "mestre@yoda"); 
        closeLoginModal();
        if (pendingAction) {
            pendingAction.func(...pendingAction.args);
            pendingAction = null;
        }
    } catch (error) {
        console.error("Erro no login:", error);
        errorEl.textContent = "Erro de autenticação com o Firebase. Verifique o console."
        errorEl.style.display = "block";
    }
});

document.getElementById("logoutButton").addEventListener("click", () => {
    signOut(auth);
});

function showLoginModal(action) {
    pendingAction = action;
    document.getElementById("loginForm").reset();
    document.getElementById("loginError").style.display = "none";
    document.getElementById("loginModal").style.display = "block";
    document.getElementById("loginEmail").focus();
}

function closeLoginModal() {
    document.getElementById("loginModal").style.display = "none";
}
document.getElementById("loginCancelBtn").addEventListener("click", closeLoginModal);


// --- LÓGICA DE ABAS ---
document.querySelector(".tab-container").addEventListener("click", (e) => {
    if (e.target.classList.contains("tab")) {
        const tabName = e.target.dataset.tab;

        document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
        e.target.classList.add("active");

        document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
        document.getElementById(tabName).classList.add("active");
    }
});

// --- FORMATAÇÃO DE DATA ---
function formatarData(isoDate) {
    if (!isoDate) return "Data indefinida";
    const [ano, mes, dia] = isoDate.split('-');
    return `${dia}/${mes}/${ano}`;
}

// --- RENDERIZAÇÃO (EXIBIÇÃO DOS DADOS) ---

// Renderizar Juntas (1ª Instância)
async function loadJuntas1() {
    try {
        const querySnapshot = await getDocs(query(juntasRef));
        const juntas = {};
        querySnapshot.forEach(doc => {
            juntas[doc.id] = doc.data();
        });

        const juntaIds = Object.keys(juntas).sort((a, b) => a.localeCompare(b));

        for (const id of juntaIds) {
            const junta = juntas[id];
            // Verifica se 'junta' e 'junta.membros' existem e se é um array
            if (!junta || !Array.isArray(junta.membros)) {
                console.warn(`Dados inválidos ou ausentes para junta ${id}`);
                continue; // Pula para a próxima junta se os dados estiverem ruins
            }
            
            const ul = document.querySelector(`#${id} ul`);
            const card = document.querySelector(`#${id}`);
            if (!ul || !card) continue;

            ul.innerHTML = ""; 
            const membrosOrdenados = junta.membros.sort((a, b) => a.nome.localeCompare(b.nome));

            membrosOrdenados.forEach(membro => {
                const li = document.createElement("li");
                const dataFormatada = formatarData(membro.dataFim);
                const renovavelClass = membro.renovavel ? 'renovavel-true' : 'renovavel-false';
                const renovavelTexto = membro.renovavel ? 'Com renovação' : 'Sem renovação';

                li.innerHTML = `
                    <div class="membro-info">
                        <span class="membro-nome">${membro.nome}</span>
                        <span class="membro-data ${renovavelClass}">
                            Até ${dataFormatada} (${renovavelTexto})
                        </span>
                    </div>
                    <button class="admin-btn delete-btn" data-collection="juntas" data-doc-id="${id}" data-membro-nome="${membro.nome}">X</button>
                `;
                ul.appendChild(li);
            });

            const oldAddBtn = card.querySelector('.add-btn');
            if (oldAddBtn) oldAddBtn.remove();
            
            if (junta.membros.length < 6) {
                const addBtn = document.createElement("button");
                addBtn.className = "admin-btn add-btn add-membro-btn";
                addBtn.textContent = "+";
                addBtn.dataset.collection = "juntas";
                addBtn.dataset.docId = id;
                card.appendChild(addBtn);
            }
        }
    } catch (error) {
        console.error("Erro ao carregar Juntas 1ª Instância:", error);
    }
}

// Renderizar Suplentes (1ª Instância)
async function loadSuplentes1() {
   try {
        const querySnapshot = await getDocs(query(suplentes1Ref, orderBy("nome")));
        const ul = document.querySelector("#suplentes1 ul"); 
        if (!ul) return;
        ul.innerHTML = "";
        querySnapshot.forEach(doc => {
            const suplente = doc.data();
             // Verifica se 'suplente' e 'suplente.nome' existem
            if (!suplente || typeof suplente.nome === 'undefined') {
                 console.warn(`Dados inválidos ou ausentes para suplente 1ª Instância ID: ${doc.id}`);
                return; // Pula este suplente
            }
            const li = document.createElement("li");
            li.innerHTML = `
                <span class="membro-nome">${suplente.nome}</span>
                <button class="admin-btn delete-btn" data-collection="suplentes" data-doc-id="${doc.id}">X</button>
            `;
            ul.appendChild(li);
        });
    } catch (error) {
         console.error("Erro ao carregar Suplentes 1ª Instância:", error);
    }
}

// Renderizar Câmaras (2ª Instância)
async function loadCamaras2() {
    try {
        const querySnapshot = await getDocs(query(camarasRef));
        const camaras = {};
        querySnapshot.forEach(doc => {
            camaras[doc.id] = doc.data();
        });

        const camaraIds = Object.keys(camaras).sort((a, b) => a.localeCompare(b));

        for (const id of camaraIds) {
            const camara = camaras[id];
             // Verifica se 'camara' e 'camara.membros' existem e se é um array
            if (!camara || !Array.isArray(camara.membros)) {
                console.warn(`Dados inválidos ou ausentes para câmara ${id}`);
                continue; 
            }
            
            const ul = document.querySelector(`#${id} ul`);
            const card = document.querySelector(`#${id}`);
            if (!ul || !card) continue;

            ul.innerHTML = ""; 
            const membrosOrdenados = camara.membros.sort((a, b) => a.nome.localeCompare(b.nome));

            membrosOrdenados.forEach(membro => {
                const li = document.createElement("li");
                const dataFormatada = formatarData(membro.dataFim);
                const renovavelClass = membro.renovavel ? 'renovavel-true' : 'renovavel-false';
                const renovavelTexto = membro.renovavel ? 'Com renovação' : 'Sem renovação';

                li.innerHTML = `
                    <div class="membro-info">
                        <span class="membro-nome">${membro.nome}</span>
                        <span class="membro-data ${renovavelClass}">
                            Até ${dataFormatada} (${renovavelTexto})
                        </span>
                    </div>
                    <button class="admin-btn delete-btn" data-collection="camaras" data-doc-id="${id}" data-membro-nome="${membro.nome}">X</button>
                `;
                ul.appendChild(li);
            });

            const oldAddBtn = card.querySelector('.add-btn');
            if (oldAddBtn) oldAddBtn.remove();
            
            if (camara.membros.length < 6) {
                const addBtn = document.createElement("button");
                addBtn.className = "admin-btn add-btn add-membro-btn";
                addBtn.textContent = "+";
                addBtn.dataset.collection = "camaras";
                addBtn.dataset.docId = id;
                card.appendChild(addBtn);
            }
        }
     } catch (error) {
        console.error("Erro ao carregar Câmaras 2ª Instância:", error);
    }
}

// Renderizar Suplentes (2ª Instância)
async function loadSuplentes2() {
    try {
        const querySnapshot = await getDocs(query(suplentes2Ref, orderBy("nome")));
        const ul = document.querySelector("#suplentes-2 ul");
        if (!ul) return;
        ul.innerHTML = "";
        querySnapshot.forEach(doc => {
            const suplente = doc.data();
            // Verifica se 'suplente' e 'suplente.nome' existem
            if (!suplente || typeof suplente.nome === 'undefined') {
                 console.warn(`Dados inválidos ou ausentes para suplente 2ª Instância ID: ${doc.id}`);
                return; // Pula este suplente
            }
            const li = document.createElement("li");
            li.innerHTML = `
                <span class="membro-nome">${suplente.nome}</span>
                <button class="admin-btn delete-btn" data-collection="suplentes2" data-doc-id="${doc.id}">X</button>
            `;
            ul.appendChild(li);
        });
    } catch (error) {
         console.error("Erro ao carregar Suplentes 2ª Instância:", error);
    }
}

// Renderizar Portarias (1ª Instância)
async function loadPortarias() {
    try {
        const parseDateFromTitle = (title = "") => { // Adiciona valor padrão
            const match = title.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (match) return `${match[3]}-${match[2]}-${match[1]}`;
            return "0000-00-00"; 
        };

        const querySnapshot = await getDocs(portariasRef);
        const portarias = [];
        querySnapshot.forEach(doc => {
             const data = doc.data();
             // Verifica se 'data' e 'data.titulo' existem
             if (data && typeof data.titulo !== 'undefined') {
                portarias.push({ id: doc.id, ...data });
             } else {
                 console.warn(`Dados inválidos ou ausentes para portaria ID: ${doc.id}`);
             }
        });

        portarias.sort((a, b) => parseDateFromTitle(a.titulo).localeCompare(parseDateFromTitle(b.titulo)));

        const ul = document.getElementById("portariaList");
        if (!ul) return;
        ul.innerHTML = "";
        portarias.forEach(portaria => {
            const li = document.createElement("li");
            li.innerHTML = `
                <div class="portaria-item">
                    <span>${portaria.titulo}</span>
                    <div>
                        <button class="view-btn" data-type="portaria" data-id="${portaria.id}">Ver</button>
                        <button class="edit-btn" data-type="portaria" data-id="${portaria.id}">Editar</button>
                        <button class="admin-btn delete-btn" data-type="portaria" data-id="${portaria.id}">X</button>
                    </div>
                </div>
            `;
            ul.appendChild(li);
        });
    } catch (error) {
         console.error("Erro ao carregar Portarias:", error);
    }
}

// Renderizar Atos do Prefeito (2ª Instância)
async function loadAtos() {
    try {
        const parseDateFromTitle = (title = "") => { // Adiciona valor padrão
            const match = title.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (match) return `${match[3]}-${match[2]}-${match[1]}`;
            return "0000-00-00"; 
        };

        const querySnapshot = await getDocs(atosRef); 
        const atos = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
             // Verifica se 'data' e 'data.titulo' existem
             if (data && typeof data.titulo !== 'undefined') {
                atos.push({ id: doc.id, ...data });
             } else {
                 console.warn(`Dados inválidos ou ausentes para ato ID: ${doc.id}`);
             }
        });
        
        atos.sort((a, b) => parseDateFromTitle(a.titulo).localeCompare(parseDateFromTitle(b.titulo)));

        const ul = document.getElementById("atosList");
        if (!ul) return;
        ul.innerHTML = "";
        atos.forEach(ato => {
            const li = document.createElement("li");
            li.innerHTML = `
                <div class="portaria-item">
                    <span>${ato.titulo}</span>
                    <div>
                        <button class="view-btn" data-type="ato" data-id="${ato.id}">Ver</button>
                        <button class="edit-btn" data-type="ato" data-id="${ato.id}">Editar</button>
                        <button class="admin-btn delete-btn" data-type="ato" data-id="${ato.id}">X</button>
                    </div>
                </div>
            `;
            ul.appendChild(li);
        });
     } catch (error) {
         console.error("Erro ao carregar Atos:", error);
    }
}


// --- LÓGICA DE CRUD --- (As funções permanecem as mesmas, mas chamam as funções de load corretas)

async function deleteMembroTitular(collectionName, docId, membroNome) {
    if (!confirm(`Tem certeza que quer excluir "${membroNome}" da ${docId}?`)) return;
    try {
        const docRef = doc(db, collectionName, docId); // Simplificado
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || !Array.isArray(docSnap.data().membros)) return; // Verifica se existe e tem membros
        
        const data = docSnap.data();
        const membroParaRemover = data.membros.find(m => m.nome === membroNome);

        if (membroParaRemover) {
            await updateDoc(docRef, {
                membros: arrayRemove(membroParaRemover)
            });
            if (collectionName === 'juntas') loadJuntas1();
            else if (collectionName === 'camaras') loadCamaras2();
        }
    } catch (error) {
        console.error("Erro ao deletar membro:", error);
        alert("Erro ao deletar membro.");
    }
}

async function deleteSuplente(collectionName, docId) {
    if (!confirm(`Tem certeza que quer excluir este suplente?`)) return;
    try {
        await deleteDoc(doc(db, collectionName, docId)); // Simplificado
        
        if (collectionName === 'suplentes') loadSuplentes1();
        else if (collectionName === 'suplentes2') loadSuplentes2();
    } catch (error) {
        console.error("Erro ao deletar suplente:", error);
        alert("Erro ao deletar suplente.");
    }
}

async function deletePortaria(portariaId) {
    if (!confirm(`Tem certeza que quer excluir esta portaria?`)) return;
    try {
        await deleteDoc(doc(portariasRef, portariaId));
        loadPortarias();
    } catch (error) {
        console.error("Erro ao deletar portaria:", error);
    }
}

async function deleteAto(atoId) {
    if (!confirm(`Tem certeza que quer excluir este ato?`)) return;
    try {
        await deleteDoc(doc(atosRef, atoId));
        loadAtos();
    } catch (error) {
        console.error("Erro ao deletar ato:", error);
    }
}


// --- MODAIS DE ADIÇÃO / EDIÇÃO ---

// Modal de Membro (Genérico)
const membroModal = document.getElementById("membroModal");
const membroForm = document.getElementById("membroForm");
const membroModalTitle = document.getElementById("membroModalTitle");
const membroCollectionRefInput = document.getElementById("membroCollectionRef");
const membroDocIdInput = document.getElementById("membroDocId");
const membroIsSuplenteInput = document.getElementById("membroIsSuplente");
const membroFieldsTitular = document.getElementById("membroFieldsTitular");

function openMembroModal(collectionName, docId = null, isSuplente = false) {
    membroForm.reset();
    membroCollectionRefInput.value = collectionName;
    membroDocIdInput.value = docId || "";
    membroIsSuplenteInput.value = isSuplente;

    if (isSuplente) {
        let title = "Adicionar Suplente";
        if (collectionName === 'suplentes') title += " (1ª Instância)";
        if (collectionName === 'suplentes2') title += " (2ª Instância)";
        membroModalTitle.textContent = title;
        membroFieldsTitular.style.display = "none";
        document.getElementById("membroDataFim").required = false;
    } else {
        membroModalTitle.textContent = `Adicionar Membro - ${docId}`;
        membroFieldsTitular.style.display = "block";
        document.getElementById("membroDataFim").required = true;
    }
    membroModal.style.display = "block";
}

function closeMembroModal() {
    membroModal.style.display = "none";
}
document.getElementById("membroCancelBtn").addEventListener("click", closeMembroModal);

membroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("membroNome").value;
    const collectionName = membroCollectionRefInput.value;
    const docId = membroDocIdInput.value;
    const isSuplente = membroIsSuplenteInput.value === 'true';
    
    let targetCollectionRef;
    if (collectionName === 'juntas') targetCollectionRef = juntasRef;
    else if (collectionName === 'camaras') targetCollectionRef = camarasRef;
    else if (collectionName === 'suplentes') targetCollectionRef = suplentes1Ref;
    else if (collectionName === 'suplentes2') targetCollectionRef = suplentes2Ref;
    else return; 

    try {
        if (isSuplente) {
            await addDoc(targetCollectionRef, { nome: nome });
            if (collectionName === 'suplentes') loadSuplentes1();
            else if (collectionName === 'suplentes2') loadSuplentes2();
        } else {
            const dataFim = document.getElementById("membroDataFim").value;
            const renovavel = document.getElementById("membroRenovavel").checked;
            const novoMembro = { nome, dataFim, renovavel };
            
            await updateDoc(doc(db, collectionName, docId), {
                membros: arrayUnion(novoMembro)
            });

            if (collectionName === 'juntas') loadJuntas1();
            else if (collectionName === 'camaras') loadCamaras2();
        }
        closeMembroModal();
    } catch (error) {
        console.error("Erro ao salvar membro:", error);
    }
});


// Modal de Portaria
const portariaModal = document.getElementById("portariaModal");
const portariaForm = document.getElementById("portariaForm");
const portariaModalTitle = document.getElementById("portariaModalTitle");
const portariaEditId = document.getElementById("portariaEditId");

function openPortariaModal() {
    portariaForm.reset();
    portariaModalTitle.textContent = "Adicionar Portaria";
    portariaEditId.value = "";
    portariaModal.style.display = "block";
}
async function openEditPortariaModal(portariaId) {
    portariaForm.reset();
    portariaModalTitle.textContent = "Editar Portaria";
    portariaEditId.value = portariaId;
    try {
        const portariaDoc = await getDoc(doc(portariasRef, portariaId));
        if (portariaDoc.exists()) {
            const data = portariaDoc.data();
            document.getElementById("portariaTitulo").value = data.titulo;
            document.getElementById("portariaLink").value = data.link;
            document.getElementById("portariaTexto").value = data.texto;
            portariaModal.style.display = "block";
        } else { alert("Portaria não encontrada."); }
    } catch (error) { console.error("Erro ao carregar portaria:", error); }
}
function closePortariaModal() { portariaModal.style.display = "none"; }
document.getElementById("portariaCancelBtn").addEventListener("click", closePortariaModal);
document.getElementById("addPortariaBtn").addEventListener("click", () => {
    if (!currentUser) showLoginModal({ func: openPortariaModal, args: [] });
    else openPortariaModal();
});

portariaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const portariaData = {
        titulo: document.getElementById("portariaTitulo").value,
        link: document.getElementById("portariaLink").value,
        texto: document.getElementById("portariaTexto").value
    };
    const editId = portariaEditId.value;
    try {
        if (editId) await updateDoc(doc(portariasRef, editId), portariaData);
        else await addDoc(portariasRef, portariaData);
        loadPortarias();
        closePortariaModal();
    } catch (error) { console.error("Erro ao salvar portaria:", error); }
});

const viewPortariaModal = document.getElementById("viewPortariaModal");
async function openViewPortariaModal(portariaId) {
    try {
        const portariaDoc = await getDoc(doc(portariasRef, portariaId));
        if (!portariaDoc.exists()) return;
        const data = portariaDoc.data();
        document.getElementById("portariaTituloDisplay").textContent = data.titulo;
        document.getElementById("portariaLinkDisplay").href = data.link;
        document.getElementById("portariaLinkDisplay").textContent = data.link;
        document.getElementById("portariaTextoDisplay").textContent = data.texto;
        viewPortariaModal.style.display = "block";
    } catch (error) { console.error("Erro ao carregar portaria:", error); }
}
function closeViewPortariaModal() { viewPortariaModal.style.display = "none"; }
document.getElementById("viewPortariaCloseBtn").addEventListener("click", closeViewPortariaModal);

// --- Modais de Atos do Prefeito ---
const atoModal = document.getElementById("atoModal");
const atoForm = document.getElementById("atoForm");
const atoModalTitle = document.getElementById("atoModalTitle");
const atoEditId = document.getElementById("atoEditId");

function openAtoModal() {
    atoForm.reset();
    atoModalTitle.textContent = "Adicionar Ato do Prefeito";
    atoEditId.value = "";
    atoModal.style.display = "block";
}
async function openEditAtoModal(atoId) {
    atoForm.reset();
    atoModalTitle.textContent = "Editar Ato do Prefeito";
    atoEditId.value = atoId;
    try {
        const atoDoc = await getDoc(doc(atosRef, atoId));
        if (atoDoc.exists()) {
            const data = atoDoc.data();
            document.getElementById("atoTitulo").value = data.titulo;
            document.getElementById("atoLink").value = data.link;
            document.getElementById("atoTexto").value = data.texto;
            atoModal.style.display = "block";
        } else { alert("Ato não encontrado."); }
    } catch (error) { console.error("Erro ao carregar ato:", error); }
}
function closeAtoModal() { atoModal.style.display = "none"; }
document.getElementById("atoCancelBtn").addEventListener("click", closeAtoModal);
document.getElementById("addAtoBtn").addEventListener("click", () => {
    if (!currentUser) showLoginModal({ func: openAtoModal, args: [] });
    else openAtoModal();
});

atoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const atoData = {
        titulo: document.getElementById("atoTitulo").value,
        link: document.getElementById("atoLink").value,
        texto: document.getElementById("atoTexto").value
    };
    const editId = atoEditId.value;
    try {
        if (editId) await updateDoc(doc(atosRef, editId), atoData);
        else await addDoc(atosRef, atoData);
        loadAtos();
        closeAtoModal();
    } catch (error) { console.error("Erro ao salvar ato:", error); }
});

const viewAtoModal = document.getElementById("viewAtoModal");
async function openViewAtoModal(atoId) {
    try {
        const atoDoc = await getDoc(doc(atosRef, atoId));
        if (!atoDoc.exists()) return;
        const data = atoDoc.data();
        document.getElementById("atoTituloDisplay").textContent = data.titulo;
        document.getElementById("atoLinkDisplay").href = data.link;
        document.getElementById("atoLinkDisplay").textContent = data.link;
        document.getElementById("atoTextoDisplay").textContent = data.texto;
        viewAtoModal.style.display = "block";
    } catch (error) { console.error("Erro ao carregar ato:", error); }
}
function closeViewAtoModal() { viewAtoModal.style.display = "none"; }
document.getElementById("viewAtoCloseBtn").addEventListener("click", closeViewAtoModal);


// --- EVENT DELEGATION ---

document.body.addEventListener("click", (e) => {
    const target = e.target;

    // Adicionar Membros/Suplentes
    if (target.matches(".add-membro-btn")) {
        const collection = target.dataset.collection;
        const docId = target.dataset.docId;
        const args = [collection, docId, false];
        if (!currentUser) showLoginModal({ func: openMembroModal, args: args });
        else openMembroModal(...args);
    }
    if (target.matches("#addSuplente1Btn")) {
        const args = ["suplentes", null, true]; 
        if (!currentUser) showLoginModal({ func: openMembroModal, args: args });
        else openMembroModal(...args);
    }
    if (target.matches("#addSuplente2Btn")) {
        const args = ["suplentes2", null, true]; 
        if (!currentUser) showLoginModal({ func: openMembroModal, args: args });
        else openMembroModal(...args);
    }

    // Deletar
    if (target.matches(".delete-btn")) {
        const collection = target.dataset.collection;
        const docId = target.dataset.docId;
        const type = target.dataset.type;
        const id = target.dataset.id;

        if (collection === 'juntas' || collection === 'camaras') {
            const membroNome = target.dataset.membroNome;
            const args = [collection, docId, membroNome];
            if (!currentUser) showLoginModal({ func: deleteMembroTitular, args: args });
            else deleteMembroTitular(...args);
        } else if (collection === 'suplentes' || collection === 'suplentes2') {
            const args = [collection, docId];
            if (!currentUser) showLoginModal({ func: deleteSuplente, args: args });
            else deleteSuplente(...args);
        } else if (type === 'portaria') {
            const args = [id];
            if (!currentUser) showLoginModal({ func: deletePortaria, args: args });
            else deletePortaria(...args);
        } else if (type === 'ato') {
            const args = [id];
            if (!currentUser) showLoginModal({ func: deleteAto, args: args });
            else deleteAto(...args);
        }
    }
    
    // Ver/Editar
    if (target.matches(".view-btn")) {
        const type = target.dataset.type;
        const id = target.dataset.id;
        if (type === 'portaria') openViewPortariaModal(id);
        else if (type === 'ato') openViewAtoModal(id);
    }
    if (target.matches(".edit-btn")) {
        const type = target.dataset.type;
        const id = target.dataset.id;
        if (type === 'portaria') {
            const args = [id];
            if (!currentUser) showLoginModal({ func: openEditPortariaModal, args: args });
            else openEditPortariaModal(...args);
        } else if (type === 'ato') {
            const args = [id];
            if (!currentUser) showLoginModal({ func: openEditAtoModal, args: args });
            else openEditAtoModal(...args);
        }
    }
});


// --- CARREGAMENTO INICIAL ---
function loadAllData() {
    loadJuntas1();
    loadSuplentes1();
    loadPortarias();
    loadCamaras2(); 
    loadSuplentes2(); 
    loadAtos(); 
}

loadAllData();
console.log("Site carregado. Para popular os dados iniciais, APAGUE as coleções antigas no Firebase e digite setupInitialData() e pressione Enter.");


// --- FUNÇÃO DE SETUP INICIAL (COMPLETA E CORRIGIDA) ---
function parseDataBR(dataStr) {
    const match = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`;
}
function parseRenovavel(renovavelStr) {
    return !renovavelStr.includes("sem possibilidade");
}

window.setupInitialData = async () => {
    console.log("Iniciando setup completo dos dados...");
    const batch = writeBatch(db);

    // --- 1. JUNTAS (1ª Instância - 'juntas') ---
    const juntasData = {
        "junta-I": [
            { nome: "Adriana Miranda Ferreira Cardoso", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Alessandro Moreira Pinheiro", dataFim: parseDataBR("30/09/2027"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Maria Imaculada Magalhães Cunha", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Lucas Paolinelli Demas Reis", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Claudio Galdino Campbell", dataFim: parseDataBR("04/11/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Alcione Santos Carvalho", dataFim: parseDataBR("09/11/2026"), renovavel: parseRenovavel("com possibilidade de renovação") }
        ],
        "junta-II": [
            { nome: "Daniel Salles Bonutti Silva", dataFim: parseDataBR("09/11/2026"), renovavel: parseRenovavel("com possibilidade de renovação") },
            { nome: "Gabriela Gonçalves Caetano", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Danieli Beatriz Gatti Lages Bergmann", dataFim: parseDataBR("04/11/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Laila Cristine Fonseca de Araujo Dias", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Elviana Barbosa Pinto Furtado", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Amanda Caroline de Souza, titular, pela FECOMÉRCIO", dataFim: parseDataBR("25/02/2027"), renovavel: parseRenovavel("com possibilidade de renovação") }
        ],
        "junta-III": [
            { nome: "José Alexandre da Silva e Souza Pinto", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Andrea Lucia Bernardes Fernandes", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Aline de Oliveira Sirio", dataFim: parseDataBR("09/11/2026"), renovavel: parseRenovavel("com possibilidade de renovação") },
            { nome: "Fabiana de Cassia Carlin", dataFim: parseDataBR("04/11/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Larissa de Souza Silva Lellis", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Priscila de Abreu Sampaio", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") }
        ],
        "junta-IV": [
            { nome: "Fernanda Irene Ferraz Pacheco", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Regina Lucia Perez Teixeira", dataFim: parseDataBR("10/03/2027"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Flávia Maria Wasner Vasconcelos", dataFim: parseDataBR("10/03/2027"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Tatiana de Oliveira Macedo", dataFim: parseDataBR("30/09/2027"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Rodrigo Peres Nobre", dataFim: parseDataBR("09/11/2026"), renovavel: parseRenovavel("com possibilidade de renovação") },
            { nome: "Carolina Dutra de Resende, titular, pela ACMINAS", dataFim: parseDataBR("10/03/2027"), renovavel: parseRenovavel("sem possibilidade de renovação") }
        ],
        "junta-V": [
            { nome: "Walter Gabriel Quintiliano Sousa", dataFim: parseDataBR("09/11/2026"), renovavel: parseRenovavel("com possibilidade de renovação") },
            { nome: "Gisele Olímpia Piedade Carneiro", dataFim: parseDataBR("09/11/2026"), renovavel: parseRenovavel("com possibilidade de renovação") },
            { nome: "Fernanda Paula Ambrosio de Castro", dataFim: parseDataBR("05/04/2026"), renovavel: parseRenovavel("com possibilidade de renovação") },
            { nome: "Pedro Henrique Ferreira Sucupira", dataFim: parseDataBR("09/11/2026"), renovavel: parseRenovavel("com possibilidade de renovação") },
            { nome: "Marcio Petronio Baeta de Souza", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Karla Alessandra rocha de Queiroz, titular, pela ABRASEL", dataFim: parseDataBR("04/05/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") }
        ]
    };
    for (const [juntaId, membros] of Object.entries(juntasData)) {
        batch.set(doc(db, "juntas", juntaId), { nome: juntaId.replace('-', '-'), membros: membros });
    }
    
    // --- 2. SUPLENTES (1ª Instância - 'suplentes') ---
    const suplentes1Data = [
        { nome: "Maria Gislei da Cunha (suplente, pela FECOMÉRCIO)" }, { nome: "Gustavo Henrique Alves (suplente, pela ABRASEL)" },
        { nome: "Adriana dos Santos Monteiro" }, { nome: "Allan Valias dos Santos" },
        { nome: "Ayrton Alves Júnior" }, { nome: "Douglas Henrique Nepomuceno dos Santos" },
        { nome: "Eduardo da Silva Santos" }, { nome: "Fernanda Turchetti Nogueira" },
        { nome: "Guilherme Augusto de Castro Machado" }, { nome: "Guilherme Valle Loures Brandão" },
        { nome: "Isabella Dometila Martins De Assis" }, { nome: "João Francisco Reis Vilela" },
        { nome: "Larissa Fonseca Mello Sarmento" }, { nome: "Lilian Grazielle Ferreira Lopes" },
        { nome: "Livia Fortini Veloso" }, { nome: "Luciana Silva Freitas de Oliveira" },
        { nome: "Mariana Diniz Attalla" }, { nome: "Mariana Lauria Zuim Pereira" },
        { nome: "Marlene Lemos de Moura Santana" }, { nome: "Sofia Vilhena Teixeira" },
        { nome: "Tatiane Daniela Fonseca Felix" }, { nome: "Viviane Pereira da Silva" }
    ];
    suplentes1Data.forEach(suplente => batch.set(doc(suplentes1Ref), suplente));

    // --- 3. PORTARIAS (1ª Instância - 'portarias') ---
    const portariasData = [
        {
            titulo: "PORTARIA SMPU Nº 012/2025 - 25/02/2025",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/7367",
            texto: `Art. 1º – Fica dispensada da função de membro titular da Junta Integrada de Julgamento Fiscal-II, a seguinte
representante da sociedade civil:
I - Lorena Assis Rocha, pela Federação do Comércio
de Minas Gerais – FECOMÉRCIO;

Art. 2º – Fica designada para a função de membro
titular da Junta Integrada de Julgamento Fiscal-II, a seguinte
representante da sociedade civil:
I - Amanda Caroline de Souza, pela Federação do
Comércio de Minas Gerais – FECOMÉRCIO;`
        },
        {
            titulo: "PORTARIA SMPU N° 002/2025 - 21/01/2025",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/7336",
            texto: `Art. 1º – Fica dispensada da função de membro titular da Junta Integrada de Julgamento Fiscal-III a seguinte servidora: 
I - Luciana Silva Freitas de Oliveira. 

Art. 2º – Fica designada para a função membro titular da Junta Integrada de Julgamento Fiscal-III a seguinte servidora: I - Fabiana de Cassia Carlin.

Art. 3º - Ficam dispensados da função de membro suplente das Juntas Integradas de Julgamento Fiscal os seguintes servidores: 
I - Thiago Machado Lage Moreira; 
II - Olga Eduarda Ferreira. 

Art. 4º – Ficam designados para a função de membro suplente das Juntas Integradas de Julgamento Fiscal os seguintes servidores:
I - Luciana Silva Freitas de Oliveira; 
II - João Francisco Reis Vilela.`
        },
        {
            titulo: "PORTARIA SMPU N° 064/2024 - 09/11/2024",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/7283",
            texto: `Define a composição dos relatores das Juntas Integradas de Julgamento Fiscal da Secretaria Municipal de Política Urbana. O Secretário Municipal de Política Urbana, no exercício de suas atribuições legais, e com base nas disposições contidas no Artigo 12, Anexo Único, do Decreto Municipal n.º 16.881, de 5 de abril de 2018, RESOLVE: 

Art. 1º – A Junta Integrada de Julgamento Fiscal I passa a ser composta pelos membros abaixo designados: 
I - Adriana Miranda Ferreira Cardoso; 
II - Alessandro Moreira Pinheiro; 
III - Maria Imaculada Magalhães Cunha; 
IV - Lucas Paolinelli Demas Reis; 
V - Claudio Galdino Campbell 
VI - Alcione Santos Carvalho. 

Art. 2º – A Junta Integrada de Julgamento Fiscal II passa a ser composta pelos membros abaixo designados: 
I - Daniel Salles Bonutti Silva; 
II - Gabriela Gonçalves Caetano; 
III - Danieli Beatriz Gatti Lages Bergmann; 
IV - Laila Cristine Fonseca de Araujo Dias; 
V - Elviana Barbosa Pinto Furtado; 
VI - Lorena Assis Rocha, titular, e Maria Gislei da Cunha, suplente, ambas pela Federação do Comércio de Minas Gerais – FECOMÉRCIO. 

Art. 3º – A Junta Integrada de Julgamento Fiscal III passa a ser composta pelos membros abaixo designados: 
I - José Alexandre da Silva e Souza Pinto; 
II - Andrea Lucia Bernardes Fernandes;
III - Aline de Oliveira Sirio; 
IV - Luciana Silva Freitas de Oliveira; 
V - Larissa de Souza Silva Lellis; 
VI - Priscila de Abreu Sampaio. 

Art. 4º – A Junta Integrada de Julgamento Fiscal IV passa a ser composta pelos membros abaixo designados:
I - Fernanda Irene Ferraz Pacheco; 
II - Regina Lucia Perez Teixeira; 
III - Flávia Maria Wasner Vasconcelos; 
IV - Tatiana de Oliveira Macedo; 
V - Rodrigo Peres Nobre; 
VI - Carolina Dutra de Resende, titular, pela Associação Comercial e Empresarial de Minas – ACMINAS. 

Art. 5º – A Junta Integrada de Julgamento Fiscal V passa a ser composta pelos membros abaixo designados:
I - Walter Gabriel Quintiliano Sousa; 
II - Gisele Olímpia Piedade Carneiro; 
III - Fernanda Paula Ambrosio de Castro; 
IV - Pedro Henrique Ferreira Sucupira; 
V - Marcio Petronio Baeta de Souza; 
VI - Karla Alessandra rocha de Queiroz, titular, e Gustavo Henrique Alves, suplente, ambas pela Associação Brasileira de Bares e Restaurantes – ABRASEL. 

Art. 6º – Ficam designados para a função de membros suplentes das Juntas Integradas de Julgamento Fiscal os seguintes servidores: 
I - Fernanda Turchetti Nogueira; 
II - Mariana Lauria Zuim Pereira; 
III - Larissa Fonseca Mello Sarmento; 
IV - Eduardo da Silva Santos; 
V - Olga Eduarda Ferreira; 
VI - Ayrton Alves Júnior; 
VII - Thiago Machado Lage Moreira; 
VIII - Marlene Lemos de Moura Santana; 
IX - Lilian Grazielle Ferreira Lopes; 
X - Allan Valias dos Santos; 
XI - Guilherme Augusto de Castro Machado; 
XII - Douglas Henrique Nepomuceno dos Santos; 
XIII - Mariana Diniz Attalla; 
XIV - Isabella Dometila Martins De Assis; 
XV - Sofia Vilhena Teixeira; 
XVI - Tatiane Daniela Fonseca Felix; 
XVII - Livia Fortini Veloso; 
XVIII - Viviane Pereira da Silva; 
XIX - Guilherme Valle Loures Brandão; 
XX - Adriana dos Santos Monteiro.`
        },
        {
            titulo: "PORTARIA SMPU N° 035/2024 - 21/06/2024",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/7150",
            texto: `Art. 1º – Ficam dispensadas das Juntas Integradas de Julgamento Fiscal da Secretaria Municipal de Política Urbana as seguintes servidoras: 
a) Andréa Neves Silveira, da função de membro titular da Junta Integrada de Julgamento Fiscal V; 
b) Andrea Pereira Froes, da função de presidenta da Junta Integrada de Julgamento Fiscal-V;
c) Livia Faria de Oliveira, da função de membro suplente das Juntas Integradas de Julgamento Fiscal. 

Art. 2º - Ficam designados para as Juntas Integradas de Julgamento Fiscal da Secretaria Municipal de Política Urbana os seguintes servidores: 
a) Denise Teixeira de Souza Guimaraes para a função de presidenta da Junta Integrada de Julgamento Fiscal-V; 
b) Larissa Fonseca Mello Sarmento para a função de membro suplente das Juntas Integradas de Julgamento Fiscal; 
c) Rejane Rodrigues Dias para a função de membro suplente das Juntas Integradas de Julgamento Fiscal; 
d) Leonardo Bedê Lotti para a função de membro suplente das Juntas Integradas de Julgamento Fiscal.`
        },
        {
            titulo: "PORTARIA SMPU N° 025/2024 - 05/04/2024",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/7095",
            texto: `Art. 1º - Dispensa das Juntas Integradas de Julgamento Fiscal da Secretaria Municipal de Política Urbana os seguintes servidores: 
I - Davidson Thiago da Cruz, da função de membro titular da Junta Integrada de Julgamento Fiscal-V; 
II - Andrea Pereira Froes, da função de membro suplente das Juntas IntegrADAS de Julgamento Fiscal; 
III - Adilson Vieira de Resende, da função de presidente da Junta Integrada de Julgamento Fiscal-V; 

Art. 2º - Designa para as Juntas Integradas de Julgamento Fiscal da Secretaria Municipal de Política Urbana os seguintes servidores: 
I - Fernanda Paula Ambrósio de Castro, para a função de membro titular Junta Integrada de Julgamento Fiscal-V; 
II - Eduardo da Silva Santos, para a função de membro suplente das Juntas Integradas de Julgamento Fiscal; 
III - Andrea Pereira Froes, para a função de presidenta da Junta Integrada de Julgamento Fiscal-V.`
        },
        {
            titulo: "PORTARIA SMPU N° 048/2023 - 30/09/2023",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6964",
            texto: `Art. 1º – Ficam dispensados da função de membro titular das Juntas Integradas de Julgamento Fiscal os seguintes servidores: 
I - Junta Integrada de Julgamento Fiscal I: 
a) Leovegildo Soares e Souza. 

II - Junta Integrada de Julgamento Fiscal IV: 
a) Cristiane da Rocha Salgueiro. 

III - Junta Integrada de Julgamento Fiscal V: 
a) Welber Frank Cantuaria Mendes. 

Art. 2º – Ficam designados para a função de membro titular das Juntas Integradas de Julgamento Fiscal os seguintes servidores: 
I - Junta Integrada de Julgamento Fiscal I: 
a) Alessandro Moreira Pinheiro 
II - Junta Integrada de Julgamento Fiscal IV: 
a) Tatiana de Oliveira Macedo 
III - Junta Integrada de Julgamento Fiscal V: 
a) Davidson Thiago da Cruz 

Art.3º - Ficam dispensados da função de membro suplente das Juntas Integradas de Julgamento Fiscal os seguintes servidores: 
I - Fernanda Turchetti Nogueira; 
II - Roberto Murta Filho; 
III - Luciano César Mendes Furtado;
IV - Paulo Joubert Alves de Souza; 
V - Márcio Xavier Eugênio; 
VI - Ildeu Pereira de Andrade; 
VII - Junia Kennea Leonard Barbosa; 
VIII - Luciene Fonseca de Mello; 
IX - Leticia Murta Peixoto. 

Art. 4º – Ficam designados para a função de membro suplente das Juntas Integradas de Julgamento Fiscal os seguintes servidores: 
I - José Augusto dos Santos Silva; 
II - Walter Gabriel Quintiliano Sousa; 
III - Fernanda Paula Ambrosio de Castro; 
IV - Gisele Olimpia Piedade Carneiro; 
V - Vanessa Angelica da Conceição Rodrigues; 
VI - Mariana Lauria Zuim Pereira; 
VII - Danielly Gonçalves de Carvalho Patente; 
VIII - Andrea Pereira Froes.`
        },
        {
            titulo: "PORTARIA SMPU Nº 016/2023 - 10/03/2023",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6811",
            texto: `Art. 1º – Ficam dispensados da função de membro titular das Juntas Integradas de Julgamento Fiscal os seguintes servidores: 
I - Junta Integrada de Julgamento Fiscal IV: 
a) Marco Antônio Medina; 
b) Juliana Colen da Silva; 
c) Luciana Silva Freitas de Oliveira. 

Art. 2º – Ficam designados para a função de membro titular das Juntas Integradas de Julgamento Fiscal os seguintes servidores: 
I - Junta Integrada de Julgamento Fiscal IV: 
a) Regina Lucia Perez Teixeira; 
b) Flavia Maria Wasner Vasconcelos; 
c) Cristina Eliane Batista Bitencourt. 

Art. 3º – Ficam dispensada da função de membro titular da Junta Integrada de Julgamento Fiscal IV a seguinte representante de entidade de classe: 
I - Brunna Alves Fernandes, titular, pela Associação Comercial e Empresarial de Minas – ACMINAS. 

Art. 4º – Fica dispensada da função de membro suplente da Junta Integrada de Julgamento Fiscal IV a seguinte representante de entidade de classe: 
I - Carolina Dutra de Resende, suplente, pela Associação Comercial e Empresarial de Minas – ACMINAS. 

Art. 5º – Fica designada para a função de membro titular da Junta Integrada de Julgamento Fiscal IV a seguinte representante de entidade de classe: 
I - Carolina Dutra de Resende, titular, pela Associação Comercial e Empresarial de Minas – ACMINAS. 

Art.6º - Fica dispensadas da função de membro suplente das Juntas Integradas de Julgamento Fiscal as seguintes servidoras: 
I - Flavia Maria Wasner Vasconcelos; 
II - Regina Lucia Perez Teixeira. 

Art. 7º – Fica designada para a função de membro suplente das Juntas Integradas de Julgamento Fiscal a seguinte servidora: 
I - Caroline de Fátima Carvalho Ferreira`
        },
        {
            titulo: "PORTARIA SMPU Nº 056/2022 - 04/11/2022",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6690",
            texto: `Art. 1º – Ficam dispensados da função de membro titular das Juntas Integradas de Julgamento Fiscal os seguintes servidores:
I - Junta Integrada de Julgamento Fiscal I:
a) Monica Yaemi Tinoco Ogura
II - Junta Integrada de Julgamento Fiscal II:
a) Lorraine Cristiane Soares de Oliveira
III - Junta Integrada de Julgamento Fiscal III:
a) Luciana Silva Freitas de Oliveira
IV - Junta Integrada de Julgamento Fiscal IV:
a) Ricardo Cordeiro e Costa

Art. 2º – Ficam designados para a função de membro titular das Juntas Integradas de Julgamento Fiscal os seguintes servidores:
I - Junta Integrada de Julgamento Fiscal I:
a) Cláudio Galdino Campbell
II - Junta Integrada de Julgamento Fiscal II:
a) Danieli Beatriz Gatti Lages Bergmann
III - Junta Integrada de Julgamento Fiscal III:
a) Fabiana de Cassia Carlin
IV - Junta Integrada de Julgamento Fiscal IV:
a) Luciana Silva Freitas de Oliveira

Art. 3º – Fica designada para a função de membro suplente da Junta Integrada de Julgamento Fiscal IV a servidora Carolina Dutra de Resende, suplente, pela Associação Comercial e Empresarial de Minas – ACMINAS.

Art. 4º - Ficam dispensados da função de membro suplente das Juntas Integradas de Julgamento Fiscal os seguintes servidores:
I - Cláudio Galdino Campbell
II - Valdete Cerutti D’Ornelas
III - Marilene Consuelo De Souza Carvalho
IV - Fabiana de Cassia Carlin

Art. 5º – Ficam designados para a função de membro suplente das Juntas Integradas de Julgamento Fiscal os seguintes servidores:
I - Alexandre Amaral Marciano
II - Flavia Maria Wasner Vasconcelos
III - Regina Lucia Perez Teixeira`
        },
        {
            titulo: "PORTARIA SMPU N° 021/2022 - 04/05/2022",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6564",
            texto: `Define a composição dos relatores das Juntas Integradas de Julgamento Fiscal da Secretaria Municipal de Política Urbana

O Secretário Municipal de Política Urbana, no exercício de suas atribuições legais, e com base nas disposições contidas no Artigo 12, Anexo Único, do Decreto Municipal n.º 16.881, de 05 de abril de 2018,

RESOLVE:

Art. 1º – A Junta Integrada de Julgamento Fiscal I passa a ser composta pelos membros abaixo designados:
a. Adriana Miranda Ferreira Cardoso
b. Leovegildo Soares e Souza
c. Maria Imaculada Magalhães Cunha
d. Lucas Paolinelli Demas Reis
e. Monica Yaemi Tinoco Ogura
f. Ariadina Rogeria de Souza Correa

Art. 2º – A Junta Integrada de Julgamento Fiscal II passa a ser composta pelos membros abaixo designados:
a. Adriana dos Santos Monteiro
b. Gabriela Gonçalves Caetano
c. Lorraine Cristiane Soares de Oliveira
d. Laila Cristine Fonseca de Araujo Dias
e. Elviana Barbosa Pinto Furtado
f. Lorena Assis Rocha, titular, e Maria Gislei da Cunha, suplente, ambas pela Federação do Comércio de Minas Gerais – FECOMÉRCIO

Art. 3º – A Junta Integrada de Julgamento Fiscal III passa a ser composta pelos membros abaixo designados:
a. José Alexandre da Silva e Souza Pinto
b. Andrea Lucia Bernardes Fernandes
c. Cesar Lopes Caetano Machado
d. Luciana Silva Freitas de Oliveira
e. Larissa de Souza Silva Lellis
f. Priscila de Abreu Sampaio

Art. 4º – A Junta Integrada de Julgamento Fiscal IV passa a ser composta pelos membros abaixo designados:
a. Ricardo Cordeiro e Costa
b. Fernanda Irene Ferraz Pacheco
c. Marco Antônio Medina
d. Cristiane da Rocha Salgueiro
e. Juliana Colen da Silva
f. Brunna Alves Fernandes, titular, pela Associação Comercial e Empresarial de Minas - ACMINAS

Art. 5º – A Junta Integrada de Julgamento Fiscal V passa a ser composta pelos membros abaixo designados:
a. Maria Ines Rosa dos Santos
b. Paula de Castro Martins
c. Andréa Neves Silveira
d. Welber Frank Cantuaria Mendes
e. Marcio Petronio Baeta de Souza
f. Karla Alessandra rocha de Queiroz, titular, e Gustavo Henrique Alves, suplente, ambas pela Associação Brasileira de Bares e Restaurantes – ABRASEL

Art. 6º – Nomear para a função de membros suplentes das Juntas Integradas de Julgamento Fiscal os seguintes servidores:
1) Fernanda Turchetti Nogueira
2) Roberto Murta Filho
3) Luciano César Mendes Furtado
4) Paulo Joubert Alves de Souza
5) Márcio Xavier Eugênio
6) Ildeu Pereira de Andrade
7) Thiago Machado Lage Moreira
8) Cláudio Galdino Campbell
9) Livia Faria de Oliveira
10) Valdete Cerutti D’Ornelas
11) Wilber Henrique Da Silva Rosa
12) Marilene Consuelo De Souza Carvalho
13) Marlene Lemos de Moura Santana
14) Camilla Harumi Ono Garcia
15) Fabiana de Cassia Carlin
16) Lilian Grazielle Ferreira Lopes
17) Junia Kennea Leonard Barbosa
18) Luciene Fonseca de Mello
19) Leticia Murta Peixoto
20) Ayrton Alves Júnior

Art. 7º - Designar para a função de secretário das Juntas Integradas de Julgamento Fiscal 4, da Secretaria Municipal de Serviços Urbanos, a partir de 18/10/2018:
1) Giovanna Santos de Oliveira – JIJFI-4;

Art. 8º - Designar para a função de secretário das Juntas Integradas de Julgamento Fiscal 5:
1) Vanessa Angélica da Conceição rodrigues - JIJFI-5.

Art. 9º - Designar para a function de presidente das Juntas Integradas de Julgamento Fiscal da Secretaria Municipal de Serviços Urbanos:
1) Carlos Roberto Rocha - JIJFI-4;
2) Adilson Vieira de Resende - JIJFI-5`
        }
    ];
    portariasData.forEach(portaria => batch.set(doc(portariasRef), portaria));
    
    // --- 4. CÂMARAS (2ª Instância - 'camaras') ---
    const camarasData = {
        "camara-1": [
            { nome: "Anna Clara da Silva Noronha", dataFim: parseDataBR("16/07/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Anne Caroline Cunha Costa", dataFim: parseDataBR("16/07/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Daniela Viana de Paula", dataFim: parseDataBR("25/04/2027"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Camilla Harumi Ono Garcia", dataFim: parseDataBR("05/10/2027"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Andréa Neves Silveira", dataFim: parseDataBR("20/06/2026"), renovavel: parseRenovavel("com possibilidade de renovação") },
            { nome: "Tatiana de Melo Braga", dataFim: parseDataBR("20/06/2026"), renovavel: parseRenovavel("com possibilidade de renovação") }
        ],
        "camara-2": [
            { nome: "Guilherme Antônio de Paiva Cunha", dataFim: parseDataBR("16/07/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Deisy Alane Souza Lacerda", dataFim: parseDataBR("16/07/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Daniel Assis Silva", dataFim: parseDataBR("16/07/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Diego de Sousa Pugas", dataFim: parseDataBR("16/07/2026"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Leovegildo Soares e Souza", dataFim: parseDataBR("05/10/2027"), renovavel: parseRenovavel("sem possibilidade de renovação") },
            { nome: "Patrícia Elizabeth Ferreira Gomes Barbosa", dataFim: parseDataBR("20/06/2026"), renovavel: parseRenovavel("com possibilidade de renovação") }
        ]
    };
    for (const [camaraId, membros] of Object.entries(camarasData)) {
        batch.set(doc(db, "camaras", camaraId), { nome: camaraId.replace('-', '-'), membros: membros });
    }

    // --- 5. SUPLENTES (2ª Instância - 'suplentes2') ---
    const suplentes2Data = [
        { nome: "Humberto Rossetti Portela (Suplente 1ª Câmara)" },
        { nome: "Fernanda Felipe Cardoso (Suplente 1ª Câmara)" },
        { nome: "Olavo Lara Resende Baeta (Suplente 2ª Câmara)" },
        { nome: "Regina Andrea Martins (Suplente 2ª Câmara)" },
        { nome: "Nilmara Oliveira Barbosa (Suplente Servidor)" },
        { nome: "Jacqueline Maltez Campos Godoy (Suplente Servidor)" },
        { nome: "Laiz Batista Lizardo (Suplente Servidor)" },
        { nome: "Welber Frank Cantuária Mendes (Suplente Servidor)" }
    ];
    suplentes2Data.forEach(suplente => batch.set(doc(suplentes2Ref), suplente));
    
    // --- 6. ATOS DO PREFEITO ('atos') ---
    // AGORA SIM, TEXTO COMPLETO E CORRIGIDO
    const atosData = [
        {
            titulo: "ATO GP Nº 842/2022 - 16/07/2022",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6616",
            texto: `Designa para compor a 1ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para cumprimento do mandato 2022/2024, a partir da data de publicação: (ATO GP Nº 842/2022) 

Representantes titulares dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados 
-Maria Aparecida Vivas; 
-Daniela dos Santos Costa Eliazar; 
-Anna Clara da Silva Noronha; 
-Mariana Lauria Zuim Pereira. 

Representantes dos profissionais de entidades representativas de classe 
-Luana Duarte Pereira, titular, e Humberto Rossetti Portela, suplente; 
-Anne Caroline Cunha Costa, titular, e Fernanda Felipe Cardoso, suplente.`
        },
        {
            titulo: "ATO GP Nº 843/2022 - 16/07/2022",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6616",
            texto: `Designa para compor a 2ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para cumprimento do mandato 2022/2024, a partir da data de publicação: (ATO GP Nº 843/2022) 

Representantes titulares dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados
-Nayara Menezes Fonseca; 
-Guilherme Antônio de Paiva Cunha; 
-Deisy Alane Souza Lacerda; 
-Daniel Assis Silva. 

Representantes dos profissionais de entidades representativas de classe
-Diego de Sousa Pugas, titular, e Olavo Lara Resende Baeta, suplente; 
-Cecília Fraga de Moraes Galvani, titular, e Ana Cecília de Sousa Ramos Barros, suplente.`
        },
        {
            titulo: "ATO GP Nº 844/2022 - 16/07/2022",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6616",
            texto: `Designa os representantes suplentes dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para cumprimento do mandato 2022/2024, a partir da data de publicação: (ATO GP Nº 844/2022) 
-Warley Rodrigues Araújo; 
-Ana Paula Lima Marinho; 
-Nilmara Oliveira Barbosa; 
-Jacqueline Maltez Campos Godoy`
        },
        {
            titulo: "ATO GP Nº 1542/2022 - 29/12/2022",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6757",
            texto: `Dispensa da 1ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, a partir da data de publicação: (ATO GP Nº 1542/2022)

Representantes titulares dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados 
-Daniela dos Santos Costa Eliazar; 
-Mariana Lauria Zuim Pereira. 

Designa para compor a 1ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para complementação do mandato 2022/2024, a partir da data de publicação: 

Representantes titulares dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados 

-Alexandra Peixoto Lamêgo Lucchesi; 
-Eula Paula Godoi Silveira de Souza.`
        },
        { // <-- CORRIGIDO AQUI
            titulo: "ATO GP Nº 484/2023 - 25/04/2023",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6842",
            texto: `Dispensa da 1ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, a partir da data de publicação: (ATO GP Nº 484/2023) 

Representante dos profissionais de entidades representativas de classe -Luana Duarte Pereira, titular. 

Designa para compor a 1ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para complementação do mandato 2022/2024, a partir da data de publicação: 

Representante dos profissionais de entidades representativas de classe

-Daniela Viana de Paula, titular.`
        },
        {
            titulo: "ATO GP Nº 1323/2023 - 05/10/2023",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6967",
            texto: `Dispensa da 1ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, a partir da data de publicação: (ATO GP Nº 1323/2023)

Representantes titulares dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados 
-Alexandra Peixoto Lamego Lucchesi; 
-Maria Aparecida Vivas. 

Designa para compor a 1ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para complementação do mandato 2022/2024, a partir da data de publicação: 

Representantes titulares dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados 
-Camilla Harumi Ono Garcia; 
-Welber Frank Cantuária Mendes.`
        },
        {
            titulo: "ATO GP Nº 1324/2023 - 05/10/2023",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6967",
            texto: `Dispensa da 2ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, a partir da data de publicação: (ATO GP Nº 1324/2023) 

Representante titular dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados 
-Nayara Menezes Fonseca. 

Designa para compor a 2ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para complementação do mandato 2022/2024, a partir da data de publicação: 

Representante titular dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados 
-Leovegildo Soares e Souza.`
        },
        {
            titulo: "ATO GP Nº 1333/2023 - 07/10/2023",
            link: "https://dom-web.pbh.gov.br/visualizacao/edicao/6969",
            texto: `Dispensa o representante suplente dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, a partir da data de publicação: (ATO GP Nº 1333/2023) 
-Warley Rodrigues Araújo. 

Designa a representante suplente dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para complementação do mandato 2022/2024, a partir da data de publicação:
-Nayara Menezes Fonseca.`
        },
        {
            titulo: "ATO GP Nº 861/2024 - 20/06/2024",
            link: "https://dom-web.pbh.gov.br/visualizacao/ato/442137",
            texto: `Dispensa da 1ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, a partir da data de publicação: (ATO GP Nº 861/2024)

Representantes titulares dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados 
-Eula Paula Godoi Silveira de Souza; 
-Welber Frank Cantuária Mendes. 

Designa para compor a 1ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para complementação do mandato 2022/2024, a partir da data de publicação: 

Representantes titulares dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados 
-Andréa Neves Silveira;
-Tatiana de Melo Braga.`
        },
        {
            titulo: "ATO GP Nº 862/2024 - 20/06/2024",
            link: "https://dom-web.pbh.gov.br/visualizacao/ato/442137",
            texto: `Dispensa da 2ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, a partir da data de publicação: (ATO GP Nº 862/2024) 

Representantes dos profissionais de entidades representativas de classe 
-Cecília Fraga de Moraes Galvani, titular, e Ana Cecília de Sousa Ramos Barros, suplente; 

Designa para compor a 2ª Câmara da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para complementação do mandato 2022/2024, a partir da data de publicação: 

Representantes dos profissionais de entidades representativas de classe -Patrícia Elizabeth Ferreira Gomes Barbosa, titular, e Regina Andrea Martins, suplente.`
        },
        {
            titulo: "ATO GP Nº 863/2024 - 20/06/2024",
            link: "https://dom-web.pbh.gov.br/visualizacao/ato/442137",
            texto: `Dispensa as representantes suplentes dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, a partir da data de publicação: (ATO GP Nº 863/2024) 
-Ana Paula Lima Marinho; 
-Nayara Menezes Fonseca. 

Designa os representantes suplentes dos servidores e empregados ocupantes de cargos e empregos públicos efetivos e comissionados da Junta Integrada de Recursos Fiscais – JIRFI, em conformidade com o Decreto nº 16.881/18, para complementação do mandato 2022/2024, a partir da data de publicação: 
-Laiz Batista Lizardo; 
-Welber Frank Cantuária Mendes`
        }
    ];
    atosData.forEach(ato => batch.set(doc(atosRef), ato));
    
    // 7. Executa
    try {
        await batch.commit();
        console.log("SUCESSO! Todos os dados (1ª e 2ª instância, portarias e atos CORRIGIDOS) foram populados.");
        loadAllData(); // Recarrega
    } catch (error) {
        console.error("ERRO ao popular dados:", error);
    }
};