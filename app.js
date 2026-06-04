const eventId = new URLSearchParams(location.search).get("id");

/* =========================
   CREATE EVENT
========================= */
async function createNewEvent() {
  const name = document.getElementById("eventName").value;
  if (!name) return alert("모임 이름을 입력해주세요!");

  const id = Math.random().toString(36).substring(2, 8);
  const link = `${location.origin}/event.html?id=${id}`;
  
  setLoading(true);
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
  setLoading(false);
  location.href = `event.html?id=${id}`;
}

/* =========================
   JOIN EVENT
========================= */
function normalizeInstagram(value) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split("/")[0]
    .split("?")[0];
}

let joining = false;
async function join() {
  if (joining) return;

  joining = true;
  setLoading(true);

  try {
    const name = document.getElementById("name").value.trim();
    const userId = crypto.randomUUID();
    const instagramId = normalizeInstagram(
      document.getElementById("ig").value
    );

    if (!name) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!instagramId) {
      alert("인스타그램 ID를 입력해주세요.");
      return;
    }

    if (!eventId) {
      alert("올바른 이벤트 접근이 아닙니다.");
      return;
    }

    const res = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      body: JSON.stringify({
        action: "join",
        eventId,
        userId,
        name,
        instagramId
      })
    });

    const result = await res.json();

    document.getElementById("name").value = "";
    document.getElementById("ig").value = "";

    if (result.status === "duplicate") {
      alert("⚠️ 이미 참여했습니다");
      return;
    }else {
      alert("🎉 등록 완료");
    }

  } catch (err) {
    console.error(err);
    alert("네트워크 오류가 발생했습니다.");
  } finally {
    joining = false;
    setLoading(false);

    load();
  }
}

function openInstagram() {
  window.location.href = "https://instagram.com/_u/instagram";
}

/* =========================
   invite
========================= */
function shareLink() {
  const link = `${location.href}`;

  navigator.clipboard.writeText(link);

  alert("공유 링크 복사됨");
}

/* =========================
   REALTIME (FETCH POLLING)
========================= */
let lastData = "";
let lastDataObj = null;
let currentData = [];

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
      updateParticipantStats();
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

async function saveTitleEdit(value) {
  try {
    value = value.trim();
    if(!value) return;

    setTitle(value);

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateEventName",
        eventId,
        eventName: value
      })
    });

    const result = await res.json();

    if (result.status !== "ok") {
      console.warn("event name update failed:", result);
    }

  } catch (err) {
    console.error("saveTitleEdit error:", err);
    alert("저장되지 않았습니다. 다시 시도해주세요.");
  }
}

function bindTitleClick() {
  const titleEl = document.getElementById("title");

  titleEl.onclick = async () => {
    const current = titleEl.innerText.replace("📍 ", "");

    const value = prompt("모임 이름 수정", current);

    if (!value || !value.trim()) return;

    await saveTitleEdit(value.trim());
  };
}

function render(data) {
  lastDataObj = data;
  setTitle(data.eventName);
  currentData = data.attendees || [];

  const list = document.getElementById("list");
  if (!list) return;

  if (data.length === 0) {
    list.innerHTML = `<div class="card" style="color: #aaa;">아직 참가자가 없습니다.</div>`;
    return;
  }
  
  const keyword = document.getElementById("name")?.value || document.getElementById("ig")?.value || "";

  const sortedData = [...currentData].sort((a, b) => {
    const aMatch = a.name.includes(keyword) || a.instagramId.includes(keyword);
    const bMatch = b.name.includes(keyword) || b.instagramId.includes(keyword);
    return bMatch - aMatch;
  });

  list.innerHTML = sortedData.map(u => `
    <div class="user" data-user-id="${u.userId}" data-instagram-id="${u.instagramId}">
      <div class="user-info-group">
        <a href="https://instagram.com/${u.instagramId}" class="no-style" target="_blank" rel="noopener noreferrer">
          <div class="avatar">
            <div class="avatar-inner">
              👤
            </div>
          </div>
        </a>
        <button class="unstyled-button" onclick="copy('@${u.instagramId}')">
          <div class="user-meta">
            <span class="name">${u.name}</span>
            <span class="ig">@${u.instagramId}</span>
          </div>
        </button>
      </div>

      <span class="badge ${u.status}" onclick="toggleStatus('${u.userId}', '${u.status}')">
        ${u.status === 'confirmed' ? '확정' : '대기'}
      </span>
    </div>
  `).join("");

  bindLongPress();
}

function showSuggestions() {
  if (lastDataObj) {
    render(lastDataObj);
  }
}

/* =========================
   COPY IG
========================= */
function copy(text) {
  navigator.clipboard.writeText(text);
  alert("복사됨: " + text);
}

let currentFilter = "all";
function copyAllIG(data, statusType) {
  let filteredList;

  if(statusType === "all"){
    filteredList = data.attendees;
  }else{
    filteredList = data.attendees.filter(u=> u.status === statusType);
  }

  const all = filteredList.map(u => `@${u.instagramId}`).join("\n");

  navigator.clipboard.writeText(all);

  alert(`${statusType === "all" ? "전체" : statusType === "pending" ? "대기" : "참여"} 인스타 ID 복사`);
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
async function toggleStatus(userId, status) {
  setLoading(true);

  const newStatus = status === "pending" ? "confirmed" : "pending";

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateStatus",
      eventId,
      userId,
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
  currentFilter = type;

  const users = document.querySelectorAll("#list .user");

  users.forEach(user => {
    const actions = user.nextElementSibling; 
    const badge = user.querySelector(".badge");
    
    const isMatch = (type === "all") || (badge && badge.classList.contains(type));

    if (isMatch) {
      user.style.display = "flex";
      if (actions && actions.classList.contains("actions")) {
        actions.style.display = "flex";
      }
    } else {
      user.style.display = "none";
      if (actions && actions.classList.contains("actions")) {
        actions.style.display = "none";
      }
    }
  });
}

function updateParticipantStats(nodes) {
  const users = document.querySelectorAll("#list .user");

  let total = 0;
  let confirmed = 0;
  let pending = 0;

  users.forEach(user => {
    if (user.style.display === "none") return;

    const badge = user.querySelector(".badge");
    const isConfirmed = badge?.classList.contains("confirmed");

    total++;

    if (isConfirmed) confirmed++;
    else pending++;
  });

  document.getElementById("participantStats").textContent =
    `(${total}명 · 확정 ${confirmed} · 대기 ${pending})`;
}

/* =========================
   UPDATE
========================= */
function editName(userId, current) {
  const name = prompt("이름 수정", current);

  if (!name) return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateUserName",
      eventId,
      userId,
      name
    })
  });

  load();
}

function editInstagram(userId, current) {
  const ig = prompt("인스타그램 ID 수정", current);
  if (!ig) return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateInstagram",
      eventId,
      userId,
      instagramId: ig
    })
  });

  load();
}

/* =========================
   DELETE EVENT
========================= */
let longPressTriggered = false;
function bindLongPress() {
  let timer = null;

  const start = (e) => {
    if (longPressTriggered) return;
    const el = e.target.closest(".user");
    if (!el) return;

    timer = setTimeout(() => {
      longPressTriggered = true;
      handleLongPress(e.target);

      setTimeout(() => {
        longPressTriggered = false;
      }, 1000);
    }, 600);
  };

  const cancel = () => {
    clearTimeout(timer);
  };

  // 모바일
  document.addEventListener("touchstart", start, { passive: true });
  document.addEventListener("touchend", cancel);
  document.addEventListener("touchmove", cancel);

  // PC
  document.addEventListener("mousedown", start);
  document.addEventListener("mouseup", cancel);
  document.addEventListener("mouseleave", cancel);

    document.addEventListener("click", (e) => {
    if (longPressTriggered) {
      e.preventDefault();
      e.stopPropagation();
      longPressTriggered = false;
    }
  }, true);
}

function handleLongPress(el) {
  const userEl = el.closest(".user");
  if (!userEl) return;

  const userId = userEl.dataset.userId;

  if (el.classList.contains("name")) {
    const current = el.innerText;
    editName(userId, current);
    return;
  }

  if (el.classList.contains("ig")) {
    const current = el.innerText.replace("@", "");
    editInstagram(userId, current);
    return;
  }

  removeUser(userId);
}

async function deleteEvent() {
  if (!confirm("모임을 정말 삭제하시겠습니까?")) return;
  setLoading(true);
  await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    body: JSON.stringify({
      action: "deleteEvent",
      eventId
    })
  });
  setLoading(false);
  alert("삭제 완료");
  location.href = "/";
}

async function removeUser(userId) {

  if (!confirm("삭제할까요?")) return;
  setLoading(true);
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "deleteUser",
      eventId,
      userId
    })
  });
  setLoading(false);
  load();
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

window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("eventTitle");

  if (saved) {
    setTitle(saved);
  }

  bindTitleClick();
});

