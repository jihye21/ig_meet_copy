const eventId = new URLSearchParams(location.search).get("id");

/* =========================
   CREATE EVENT
========================= */
async function createNewEvent() {
  const name = document.getElementById("eventName").value;
  if (!name) return alert("모임 이름을 입력해주세요!");

  const id = Math.random().toString(36).substring(2, 8);
  const link = `${location.origin}/event.html?id=${id}`;
  
  document.getElementById("result").innerHTML = `
    <div class="card">
      <input value="${link}" onclick="this.select()" readonly />
    </div>
  `;

  await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    body: JSON.stringify({
      action: "createEvent",
      eventId: id,
      eventName: name
    })
  });

  location.href = `event.html?id=${id}`;
}

/* =========================
   JOIN EVENT
========================= */
async function join() {
  setLoading(true);
  const name = document.getElementById("name").value;
  const instagramId = document.getElementById("ig").value.replace("@","");

  if (!eventId) return alert("올바른 이벤트 접근이 아닙니다.");

  const res = await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    body: JSON.stringify({
      action: "join",
      eventId,
      name,
      instagramId
    })
  });
  
  const result = await res.json();

  setLoading(false);

  if (result.status === "duplicate") {
    alert("⚠️ 이미 참여했습니다");
    return;
  }

  load();
}

/* =========================
   invite
========================= */
function shareLink() {
  const link = `${location.origin}/event.html?id=${eventId}`;

  navigator.clipboard.writeText(link);

  alert("공유 링크 복사됨");
}

/* =========================
   REALTIME (FETCH POLLING)
========================= */
let lastData = "";
async function load() {
  if (!eventId) return; 

  try {
    const res = await fetch(`${API_URL}?eventId=${eventId}`, {
      method: "GET",
      redirect: "follow"
    });
    
    if (!res.ok) throw new Error("네트워크 응답 이상");
    const data = await res.json();
    
    const currentDataStr = JSON.stringify(data.attendees);
    if (lastData !== currentDataStr) {
      lastData = currentDataStr;
      render(data);
    }
  } catch (error) {
    console.error("데이터를 가져오는 중 오류 발생:", error);
  }
}

/* =========================
   RENDER LIST (NOTION STYLE)
========================= */
function setTitle(name) {
  const titleEl = document.getElementById("title");
  if (titleEl && name) {
    titleEl.innerText = `📍 ${name}`;
  }
}

function render(data) {
  lastDataObj = data;
  setTitle(data.eventName);
  
  const list = document.getElementById("list");
  
  if (!list) return;

  const attendees = data.attendees || [];

  if (data.length === 0) {
    list.innerHTML = `<div class="card" style="color: #aaa;">아직 참가자가 없습니다.</div>`;
    return;
  }

  list.innerHTML = attendees.map(u => `
    <div class="card">
      <div class="user">
        <div>
          <div class="name">${u.name}</div>
          <div class="ig">@${u.instagramId}</div>
        </div>
        <div class="badge ${u.status}">
          ${u.status}
        </div>
      </div>
      <div class="actions">
        <button onclick="copy('@${u.instagramId}')">복사</button>
        <button onclick="toggleStatus('${u.instagramId}', '${u.status}')">
          상태 변경
        </button>
      </div>
    </div>
  `).join("");
}

/* =========================
   COPY IG
========================= */
function copy(text) {
  navigator.clipboard.writeText(text);
  alert("복사됨: " + text);
}

function copyAllIG(data) {
  const all = data.attendees.map(u => `@${u.instagramId}`).join("\n");

  navigator.clipboard.writeText(all);

  alert("전체 인스타 ID 복사됨");
}

/* =========================
   loading
========================= */
let loading = false;

function setLoading(state) {
  loading = state;
  document.body.classList.toggle("loading", state);
}

/* =========================
   STATUS TOGGLE
========================= */
async function toggleStatus(instagramId, status) {
  setLoading(true);

  const newStatus = status === "pending" ? "confirmed" : "pending";

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateStatus",
      eventId,
      instagramId,
      status: newStatus
    })
  });

  setLoading(false);
  load();
}

/* =========================
   FILTER UI
========================= */
function filterStatus(type) {
  const cards = document.querySelectorAll("#list .card");

  cards.forEach(c => {
    if (type === "all") {
      c.style.display = "flex"; 
    } else {
      
      const badge = c.querySelector(".badge");
      if (badge) {
        c.style.display = badge.classList.contains(type) ? "flex" : "none";
      }
    }
  });
}

/* =========================
   DELETE EVENT
========================= */
async function deleteEvent() {
  if (!confirm("모임을 정말 삭제하시겠습니까?")) return;

  await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    body: JSON.stringify({
      action: "deleteEvent",
      eventId
    })
  });

  alert("삭제 완료");
  location.href = "/";
}

/* =========================
   INITIALIZATION (초기 실행 제어)
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const createBtn = document.getElementById("btnCreateEvent");
  if (createBtn) {
    createBtn.addEventListener("click", createNewEvent);
    console.log("모임 생성 페이지 준비 완료. 생성 버튼 이벤트 연결됨.");
  }

  if (eventId) {
    console.log(`이벤트 ID (${eventId}) 감지 - 실시간 데이터 로딩을 시작합니다.`);
    load();
    setInterval(load, 3000);
  }
});