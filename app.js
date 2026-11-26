import { auth, db, isFirebaseConfigured } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp, collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
let isRegister = false;
let currentUser = null;
let activeConversationId = null;
let stopConversationListener = null;
let chatBusy = false;
const API_BASE_URL = "https://bizpiloht-ai-backend.onrender.com"; // Change to your deployed HTTPS backend URL before publishing the frontend.
const descriptions = {
  overview: ["Overview", "Your business workspace at a glance."],
  assistant: ["AI Assistant", "A helpful AI partner for everyday business questions, planning and problem-solving."],
  content: ["Content Studio", "Create polished business emails, marketing content, proposals and more."],
  analytics: ["Business Insights", "Understand business activity with reports, trends and practical insights."],
  documents: ["Documents", "Organize business documents and prepare them for AI-powered analysis."]
};

$("todayDate").textContent = new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(new Date());
$("year").textContent = new Date().getFullYear();

function showToast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function setMessage(message=""){ $("formMessage").textContent=message; }
function openAuth(register=false){isRegister=register;updateAuthMode();$("authModal").classList.remove("hidden");setMessage("");}
function closeAuth(){$("authModal").classList.add("hidden");$("authForm").reset();setMessage("")}
function updateAuthMode(){
  $("modalTitle").textContent=isRegister?"Create your account":"Welcome back";
  $("modalSubtitle").textContent=isRegister?"Start building a smarter business workspace.":"Sign in to continue to your workspace.";
  $("fullName").classList.toggle("hidden",!isRegister);
  $("fullName").required=isRegister;
  $("password").autocomplete=isRegister?"new-password":"current-password";
  $("submitAuth").textContent=isRegister?"Create account":"Sign in";
  $("toggleAuth").textContent=isRegister?"Already have an account? Sign in":"New to BizPilot? Create an account";
  $("resetPassword").classList.toggle("hidden",isRegister);
}
function updateUserUI(user){
  currentUser=user;
  if(!user){activeConversationId=null;if(stopConversationListener){stopConversationListener();stopConversationListener=null}}
  const name=user?.displayName || user?.email?.split("@")[0] || "Guest user";
  $("profileName").textContent=user?name:"Guest user";
  $("profileEmail").textContent=user?.email || "Not signed in";
  $("avatar").textContent=user?(name.trim()[0]||"U").toUpperCase():"G";
  $("welcomeName").textContent=user?`, ${name.split(" ")[0]}`:"";
  $("authButton").textContent=user?"Sign out":"Sign in";
  $("accountStatus").textContent=user?"Account connected":"Guest preview";
  $("accountDescription").textContent=user?"Your personal workspace is connected. More tools will be enabled in upcoming phases.":"Sign in to save your profile and use your personal workspace across devices.";
  $("accountAction").textContent=user?"Account connected":"Create free account";
  $("checkProfile").checked=!!user;
  updateProgress();
  if(user && !$("assistantWorkspace").classList.contains("hidden")) loadConversationList();
}
function updateProgress(){
  const count=[$("checkProfile"),$("checkExplore"),$("checkPlan")].filter(x=>x.checked).length;
  $("progressLabel").textContent=`${count} of 3`;
  $("progressBar").style.width=`${count/3*100}%`;
}
function navigate(view){
  const [title,desc]=descriptions[view]||descriptions.overview;
  document.querySelectorAll(".nav-item").forEach(btn=>btn.classList.toggle("active",btn.dataset.view===view));
  $("breadcrumbTitle").textContent=title;
  $("overviewView").classList.toggle("hidden",view!=="overview");
  $("secondaryView").classList.toggle("hidden",view==="overview");
  $("secondaryTitle").textContent=title;
  $("secondaryDescription").textContent=desc;
  const isAssistant=view==="assistant";
  $("assistantWorkspace").classList.toggle("hidden",!isAssistant);
  $("assistantSetupHint").classList.toggle("hidden",!isAssistant);
  $("otherComingPanel").classList.toggle("hidden",isAssistant);
  if(isAssistant && currentUser) loadConversationList();
  $("sidebar").classList.remove("open");
  if(view!=="overview") $("checkExplore").checked=true;
  updateProgress();
}
document.querySelectorAll("[data-view]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.view)));
document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.go)));
$("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("authButton").addEventListener("click",async()=>{
  if(currentUser){try{await signOut(auth);showToast("You have signed out.")}catch(e){showToast("Could not sign out. Try again.")}}
  else if(!isFirebaseConfigured){openAuth();setMessage("Add your Firebase project configuration first. See README.md.");}
  else openAuth(false);
});
$("accountAction").addEventListener("click",()=>currentUser?showToast("Your account is connected."):(!isFirebaseConfigured?(openAuth(),setMessage("Add your Firebase project configuration first. See README.md.")):openAuth(true)));
$("profileButton").addEventListener("click",()=>currentUser?showToast("Signed in as "+currentUser.email):openAuth(true));
$("closeModal").addEventListener("click",closeAuth);
$("authModal").addEventListener("click",e=>{if(e.target===$("authModal"))closeAuth()});
$("toggleAuth").addEventListener("click",()=>{isRegister=!isRegister;updateAuthMode();setMessage("")});
$("resetPassword").addEventListener("click",async()=>{
  const email=$("email").value.trim();
  if(!email){setMessage("Enter your email address first.");return}
  try{await sendPasswordResetEmail(auth,email);setMessage("Password reset email sent. Check your inbox.");}
  catch(e){setMessage(friendlyError(e))}
});
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();setMessage("");
  if(!isFirebaseConfigured){setMessage("Firebase is not configured yet. Follow the setup steps in README.md.");return}
  const email=$("email").value.trim(),password=$("password").value,name=$("fullName").value.trim();
  const submit=$("submitAuth");submit.disabled=true;submit.textContent="Please wait…";
  try{
    if(isRegister){
      const result=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(result.user,{displayName:name});
      await setDoc(doc(db,"users",result.user.uid),{uid:result.user.uid,displayName:name,email,role:"owner",createdAt:serverTimestamp(),plan:"free"},{merge:true});
      updateUserUI(result.user);closeAuth();showToast("Your BizPilot account is ready.");
    }else{
      const result=await signInWithEmailAndPassword(auth,email,password);
      updateUserUI(result.user);closeAuth();showToast("Welcome back.");
    }
  }catch(error){setMessage(friendlyError(error))}
  finally{submit.disabled=false;updateAuthMode()}
});
// Phase 2: authenticated AI chat with private Firestore conversation history.
const chatMessagesEl=$("chatMessages"), chatInput=$("chatInput");
function addChatBubble(role,text){
  const bubble=document.createElement("div");bubble.className=`chat-message ${role}`;
  const label=document.createElement("span");label.className="message-label";label.textContent=role==="user"?"YOU":"BIZPILOT AI";
  const body=document.createElement("div");body.textContent=text;
  bubble.append(label,body);chatMessagesEl.appendChild(bubble);chatMessagesEl.scrollTop=chatMessagesEl.scrollHeight;return bubble;
}
function showChatWelcome(){chatMessagesEl.innerHTML='<div class="assistant-welcome"><div class="coming-icon">✦</div><h2>What can we work on?</h2><p class="muted">Ask for business ideas, customer replies, marketing plans, operations advice and more.</p><div class="prompt-chips"><button type="button" data-prompt="Create a simple marketing plan for my small business.">Create a marketing plan</button><button type="button" data-prompt="Help me write a professional reply to an unhappy customer.">Reply to a customer</button><button type="button" data-prompt="Give me five practical ways to increase sales this month.">Grow my sales</button></div></div>';}
async function loadConversationList(){
  const list=$("conversationList");if(!currentUser){list.innerHTML='<p class="muted">Sign in to see your saved conversations.</p>';return}
  try{
    const q=query(collection(db,"users",currentUser.uid,"conversations"),orderBy("updatedAt","desc"),limit(30));
    const snap=await getDocs(q);list.innerHTML="";
    if(snap.empty){list.innerHTML='<p class="muted">No conversations yet. Start a new chat.</p>';return}
    snap.forEach(item=>{const data=item.data();const b=document.createElement("button");b.className="conversation-item"+(item.id===activeConversationId?" active":"");b.textContent=data.title||"New conversation";b.title=b.textContent;b.addEventListener("click",()=>openConversation(item.id));list.appendChild(b)});
  }catch(e){list.innerHTML='<p class="muted">Could not load chat history. Check Firestore rules.</p>';}
}
async function newConversation(){
  if(!currentUser){openAuth(false);setMessage("Please sign in to use the AI Assistant.");return}
  try{
    const ref=await addDoc(collection(db,"users",currentUser.uid,"conversations"),{title:"New conversation",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    activeConversationId=ref.id;if(stopConversationListener){stopConversationListener();stopConversationListener=null}showChatWelcome();await openConversation(ref.id);chatInput.focus();
  }catch(e){$("chatError").textContent="Could not create a conversation. Check your Firestore rules.";}
}
async function openConversation(id){
  if(!currentUser)return;activeConversationId=id;if(stopConversationListener){stopConversationListener();stopConversationListener=null}
  chatMessagesEl.innerHTML="";$("chatError").textContent="";
  try{
    const q=query(collection(db,"users",currentUser.uid,"conversations",id,"messages"),orderBy("createdAt","asc"),limit(100));
    stopConversationListener=onSnapshot(q,snap=>{chatMessagesEl.innerHTML="";if(snap.empty)showChatWelcome();else snap.forEach(m=>{const d=m.data();addChatBubble(d.role,d.text)});});
    await loadConversationList();
  }catch(e){$("chatError").textContent="Could not open this conversation.";}
}
async function sendChatMessage(message){
  if(chatBusy)return;if(!currentUser){openAuth(false);setMessage("Please sign in before sending a message.");return}
  if(!activeConversationId)await newConversation();if(!activeConversationId)return;
  chatBusy=true;$("sendChatButton").disabled=true;$("sendChatButton").textContent="Thinking…";$("chatError").textContent="";
  try{
    const conversationRef=doc(db,"users",currentUser.uid,"conversations",activeConversationId);
    const messagesRef=collection(db,"users",currentUser.uid,"conversations",activeConversationId,"messages");
    const historySnap=await getDocs(query(messagesRef,orderBy("createdAt","desc"),limit(12)));
    const history=historySnap.docs.reverse().map(d=>({role:d.data().role,content:d.data().text}));
    await addDoc(messagesRef,{role:"user",text:message,createdAt:serverTimestamp()});
    const currentTitle=message.length>42?message.slice(0,39)+"…":message;
    await updateDoc(conversationRef,{title:currentTitle,updatedAt:serverTimestamp()});
    const token=await currentUser.getIdToken();
    const response=await fetch(`${API_BASE_URL}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({provider:$("providerSelect").value,message,history})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||`AI service error (${response.status}). Check backend setup.`);
    if(!result.reply)throw new Error("The AI service returned an empty response.");
    await addDoc(messagesRef,{role:"assistant",text:result.reply,provider:result.provider||$("providerSelect").value,createdAt:serverTimestamp()});
    await updateDoc(conversationRef,{updatedAt:serverTimestamp()});await loadConversationList();
  }catch(e){$("chatError").textContent=e.message||"Could not get an AI response. Check your backend and provider API key.";}
  finally{chatBusy=false;$("sendChatButton").disabled=false;$("sendChatButton").textContent="Send ↑";}
}
$("newChatButton").addEventListener("click",newConversation);
$("chatForm").addEventListener("submit",async e=>{e.preventDefault();const msg=chatInput.value.trim();if(!msg)return;chatInput.value="";await sendChatMessage(msg)});
chatMessagesEl.addEventListener("click",e=>{const b=e.target.closest("[data-prompt]");if(b){chatInput.value=b.dataset.prompt;chatInput.focus()}});

function friendlyError(error){
  const code=error?.code||"";
  const messages={
    "auth/email-already-in-use":"An account with this email already exists.",
    "auth/invalid-email":"Enter a valid email address.",
    "auth/weak-password":"Choose a password with at least 6 characters.",
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/user-not-found":"No account was found for this email.",
    "auth/wrong-password":"Email or password is incorrect.",
    "auth/too-many-requests":"Too many attempts. Please try again later.",
    "auth/network-request-failed":"Network error. Check your internet connection."
  };
  return messages[code]||"Something went wrong. Please try again.";
}
["checkExplore","checkPlan"].forEach(id=>$(id).addEventListener("change",updateProgress));
if(isFirebaseConfigured){
  onAuthStateChanged(auth,user=>updateUserUI(user));
}else{
  updateUserUI(null);
  $("accountStatus").textContent="Setup required";
  $("accountDescription").textContent="Connect your Firebase project to activate secure registration and sign-in.";
}
if("serviceWorker" in navigator && location.protocol!=="file:"){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
}
