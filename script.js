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

// Referências das Coleções
const juntasRef = collection(db, "juntas");
const suplentesRef = collection(db, "suplentes");
const portariasRef = collection(db, "portarias");

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

    // A senha "mestre@yoda" é verificada aqui, mas não preenchida na tela
    if (email.toLowerCase() !== "mestre@yoda.com" || senha !== "mestre@yoda") {
        errorEl.style.display = "block";
        return;
    }

    try {
        // Usamos o e-mail/senha reais cadastrados no Firebase Auth
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
    document.getElementById("loginForm").reset(); // Limpa o formulário
    document.getElementById("loginError").style.display = "none";
    // REMOVIDO: O preenchimento automático da senha
    document.getElementById("loginModal").style.display = "block";
    document.getElementById("loginEmail").focus(); // Foca no campo de e-mail
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

// Renderizar Juntas
async function loadJuntas() {
    const querySnapshot = await getDocs(query(juntasRef));
    const juntas = {};
    querySnapshot.forEach(doc => {
        juntas[doc.id] = doc.data();
    });

    const juntaIds = Object.keys(juntas).sort((a, b) => a.localeCompare(b));

    for (const id of juntaIds) {
        const junta = juntas[id];
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
                <button class="admin-btn delete-btn" data-junta-id="${id}" data-membro-nome="${membro.nome}">X</button>
            `;
            ul.appendChild(li);
        });

        const oldAddBtn = card.querySelector('.add-btn');
        if (oldAddBtn) oldAddBtn.remove();
        
        if (junta.membros.length < 6) {
            const addBtn = document.createElement("button");
            addBtn.className = "admin-btn add-btn";
            addBtn.textContent = "+";
            addBtn.dataset.juntaId = id;
            card.appendChild(addBtn);
        }
    }
}

// Renderizar Suplentes
async function loadSuplentes() {
    const querySnapshot = await getDocs(query(suplentesRef, orderBy("nome")));
    const ul = document.querySelector("#suplentes ul");
    ul.innerHTML = "";
    querySnapshot.forEach(doc => {
        const suplente = doc.data();
        const li = document.createElement("li");
        li.innerHTML = `
            <span class="membro-nome">${suplente.nome}</span>
            <button class="admin-btn delete-btn" data-suplente-id="${doc.id}">X</button>
        `;
        ul.appendChild(li);
    });
}

// Renderizar Portarias
async function loadPortarias() {
    const parseDateFromTitle = (title) => {
        const match = title.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
            return `${match[3]}-${match[2]}-${match[1]}`; // YYYY-MM-DD
        }
        return "0000-00-00"; 
    };

    const querySnapshot = await getDocs(portariasRef);
    const portarias = [];
    querySnapshot.forEach(doc => {
        portarias.push({ id: doc.id, ...doc.data() });
    });

    portarias.sort((a, b) => {
        const dateA = parseDateFromTitle(a.titulo);
        const dateB = parseDateFromTitle(b.titulo);
        return dateA.localeCompare(dateB);
    });

    const ul = document.getElementById("portariaList");
    ul.innerHTML = "";
    portarias.forEach(portaria => {
        const li = document.createElement("li");
        // ADICIONADO: Botão "Editar"
        li.innerHTML = `
            <div class="portaria-item">
                <span>${portaria.titulo}</span>
                <div>
                    <button class="view-btn" data-portaria-id="${portaria.id}">Ver</button>
                    <button class="edit-btn" data-portaria-id="${portaria.id}">Editar</button>
                    <button class="admin-btn delete-btn" data-portaria-id="${portaria.id}">X</button>
                </div>
            </div>
        `;
        ul.appendChild(li);
    });
}

// --- LÓGICA DE CRUD (Create, Read, Update, Delete) ---

async function deleteMembroTitular(juntaId, membroNome) {
    if (!confirm(`Tem certeza que quer excluir "${membroNome}" da ${juntaId}?`)) return;
    try {
        const juntaDocRef = doc(db, "juntas", juntaId);
        const juntaDoc = await getDoc(juntaDocRef);
        const juntaData = juntaDoc.data();
        const membroParaRemover = juntaData.membros.find(m => m.nome === membroNome);

        if (membroParaRemover) {
            await updateDoc(juntaDocRef, {
                membros: arrayRemove(membroParaRemover)
            });
            loadJuntas();
        }
    } catch (error) {
        console.error("Erro ao deletar membro:", error);
        alert("Erro ao deletar membro.");
    }
}

async function deleteSuplente(suplenteId) {
    if (!confirm(`Tem certeza que quer excluir este suplente?`)) return;
    try {
        await deleteDoc(doc(db, "suplentes", suplenteId));
        loadSuplentes();
    } catch (error) {
        console.error("Erro ao deletar suplente:", error);
        alert("Erro ao deletar suplente.");
    }
}

async function deletePortaria(portariaId) {
    if (!confirm(`Tem certeza que quer excluir esta portaria?`)) return;
    try {
        await deleteDoc(doc(db, "portarias", portariaId));
        loadPortarias();
    } catch (error) {
        console.error("Erro ao deletar portaria:", error);
        alert("Erro ao deletar portaria.");
    }
}

// --- MODAIS DE ADIÇÃO / EDIÇÃO ---

// Modal de Membro
const membroModal = document.getElementById("membroModal");
const membroForm = document.getElementById("membroForm");
const membroModalTitle = document.getElementById("membroModalTitle");
const membroJuntaIdInput = document.getElementById("membroJuntaId");
const membroSuplenteModeInput = document.getElementById("membroSuplenteMode");
const membroFieldsTitular = document.getElementById("membroFieldsTitular");

function openMembroModal(juntaId, isSuplente = false) {
    membroForm.reset();
    if (isSuplente) {
        membroModalTitle.textContent = "Adicionar Suplente";
        membroJuntaIdInput.value = "";
        membroSuplenteModeInput.value = "true";
        membroFieldsTitular.style.display = "none";
        document.getElementById("membroDataFim").required = false;
    } else {
        membroModalTitle.textContent = `Adicionar Membro - ${juntaId}`;
        membroJuntaIdInput.value = juntaId;
        membroSuplenteModeInput.value = "false";
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
    const isSuplente = membroSuplenteModeInput.value === "true";
    
    try {
        if (isSuplente) {
            await addDoc(suplentesRef, { nome: nome });
            loadSuplentes();
        } else {
            const juntaId = membroJuntaIdInput.value;
            const dataFim = document.getElementById("membroDataFim").value;
            const renovavel = document.getElementById("membroRenovavel").checked;
            const novoMembro = { nome, dataFim, renovavel };
            await updateDoc(doc(db, "juntas", juntaId), {
                membros: arrayUnion(novoMembro)
            });
            loadJuntas();
        }
        closeMembroModal();
    } catch (error) {
        console.error("Erro ao salvar membro:", error);
        alert("Erro ao salvar membro.");
    }
});

// Modal de Portaria (Agora com Edição)
const portariaModal = document.getElementById("portariaModal");
const portariaForm = document.getElementById("portariaForm");
const portariaModalTitle = document.getElementById("portariaModalTitle");
const portariaEditId = document.getElementById("portariaEditId");

// Abre o modal para ADICIONAR
function openPortariaModal() {
    portariaForm.reset();
    portariaModalTitle.textContent = "Adicionar Portaria";
    portariaEditId.value = ""; // Garante que está em modo de adição
    portariaModal.style.display = "block";
}
// Abre o modal para EDITAR
async function openEditPortariaModal(portariaId) {
    portariaForm.reset();
    portariaModalTitle.textContent = "Editar Portaria";
    portariaEditId.value = portariaId; // Define o ID para edição
    
    try {
        const portariaDoc = await getDoc(doc(db, "portarias", portariaId));
        if (portariaDoc.exists()) {
            const data = portariaDoc.data();
            document.getElementById("portariaTitulo").value = data.titulo;
            document.getElementById("portariaLink").value = data.link;
            document.getElementById("portariaTexto").value = data.texto;
            portariaModal.style.display = "block";
        } else {
            alert("Portaria não encontrada.");
        }
    } catch (error) {
        console.error("Erro ao carregar portaria para edição:", error);
        alert("Erro ao carregar portaria.");
    }
}

function closePortariaModal() {
    portariaModal.style.display = "none";
}
document.getElementById("portariaCancelBtn").addEventListener("click", closePortariaModal);

document.getElementById("addPortariaBtn").addEventListener("click", () => {
    if (!currentUser) {
        showLoginModal({ func: openPortariaModal, args: [] });
    } else {
        openPortariaModal();
    }
});

// Formulário de Portaria (Salva Adição ou Edição)
portariaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const portariaData = {
        titulo: document.getElementById("portariaTitulo").value,
        link: document.getElementById("portariaLink").value,
        texto: document.getElementById("portariaTexto").value
    };
    
    const editId = portariaEditId.value; // Pega o ID do input oculto

    try {
        if (editId) {
            // Modo Edição (Atualiza o documento existente)
            await updateDoc(doc(db, "portarias", editId), portariaData);
        } else {
            // Modo Adição (Cria um novo documento)
            await addDoc(portariasRef, portariaData);
        }
        loadPortarias();
        closePortariaModal();
    } catch (error) {
        console.error("Erro ao salvar portaria:", error);
        alert("Erro ao salvar portaria.");
    }
});


// Modal de Visualizar Portaria
const viewPortariaModal = document.getElementById("viewPortariaModal");
async function openViewPortariaModal(portariaId) {
    try {
        const portariaDoc = await getDoc(doc(db, "portarias", portariaId));
        if (!portariaDoc.exists()) return;
        
        const data = portariaDoc.data();
        document.getElementById("portariaTituloDisplay").textContent = data.titulo;
        document.getElementById("portariaLinkDisplay").href = data.link;
        document.getElementById("portariaLinkDisplay").textContent = data.link;
        document.getElementById("portariaTextoDisplay").textContent = data.texto;
        
        viewPortariaModal.style.display = "block";
    } catch (error) {
        console.error("Erro ao carregar portaria:", error);
    }
}
function closeViewPortariaModal() {
    viewPortariaModal.style.display = "none";
}
document.getElementById("viewPortariaCloseBtn").addEventListener("click", closeViewPortariaModal);


// --- EVENT DELEGATION (Gerenciador de cliques) ---

document.body.addEventListener("click", (e) => {
    const target = e.target;

    // --- CLIQUES DE MEMBROS ---
    if (target.matches(".delete-btn[data-junta-id]")) {
        const args = [ target.dataset.juntaId, target.dataset.membroNome ];
        if (!currentUser) {
            showLoginModal({ func: deleteMembroTitular, args: args });
        } else {
            deleteMembroTitular(...args);
        }
    }
    
    if (target.matches(".add-btn[data-junta-id]")) {
        const args = [target.dataset.juntaId];
        if (!currentUser) {
            showLoginModal({ func: openMembroModal, args: args });
        } else {
            openMembroModal(...args);
        }
    }
    
    // --- CLIQUES DE SUPLENTES ---
    if (target.matches(".delete-btn[data-suplente-id]")) {
        const args = [target.dataset.suplenteId];
        if (!currentUser) {
            showLoginModal({ func: deleteSuplente, args: args });
        } else {
            deleteSuplente(...args);
        }
    }

    if (target.matches("#addSuplenteBtn")) {
        if (!currentUser) {
            showLoginModal({ func: openMembroModal, args: [null, true] });
        } else {
            openMembroModal(null, true);
        }
    }
    
    // --- CLIQUES DE PORTARIAS ---
    if (target.matches(".view-btn[data-portaria-id]")) {
        openViewPortariaModal(target.dataset.portariaId);
    }

    // NOVO: Listener para o botão Editar
    if (target.matches(".edit-btn[data-portaria-id]")) {
        const args = [target.dataset.portariaId];
        if (!currentUser) {
            showLoginModal({ func: openEditPortariaModal, args: args });
        } else {
            openEditPortariaModal(...args);
        }
    }
    
    if (target.matches(".delete-btn[data-portaria-id]")) {
        const args = [target.dataset.portariaId];
        if (!currentUser) {
            showLoginModal({ func: deletePortaria, args: args });
        } else {
            deletePortaria(...args);
        }
    }
});


// --- CARREGAMENTO INICIAL ---
function loadAllData() {
    loadJuntas();
    loadSuplentes();
    loadPortarias();
}

loadAllData();
console.log("Site carregado. Para popular os dados iniciais, digite setupInitialData() e pressione Enter.");


// --- FUNÇÃO DE SETUP INICIAL (SÓ RODAR UMA VEZ) ---
// Contém os dados completos das portarias
function parseDataBR(dataStr) {
    const match = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`; // YYYY-MM-DD
}
function parseRenovavel(renovavelStr) {
    return !renovavelStr.includes("sem possibilidade");
}

window.setupInitialData = async () => {
    console.log("Iniciando setup dos dados...");
    const batch = writeBatch(db);

    // 1. Juntas (Mesmos dados)
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
    
    // 2. Suplentes (Mesmos dados)
    const suplentesData = [
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
    suplentesData.forEach(suplente => {
        batch.set(doc(suplentesRef), suplente);
    });

    // 3. Portarias (AGORA COM TEXTO COMPLETO)
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
II - Andrea Pereira Froes, da função de membro suplente das Juntas Integradas de Julgamento Fiscal; 
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

    portariasData.forEach(portaria => {
        batch.set(doc(portariasRef), portaria);
    });
    
    // 4. Executa
    try {
        await batch.commit();
        console.log("SUCESSO! Os dados iniciais foram populados no Firebase.");
        loadAllData(); // Recarrega
    } catch (error) {
        console.error("ERRO ao popular dados:", error);
        alert("Ocorreu um erro ao salvar os dados iniciais. Verifique o console.");
    }
};