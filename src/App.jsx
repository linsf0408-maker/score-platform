import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "score_platform_data";
const COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#14b8a6","#f97316"];
function getColor(i) { return COLORS[i % COLORS.length]; }

function Avatar({ name, color }) {
  return (
    <div style={{width:40,height:40,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:16,flexShrink:0}}>
      {name?.[0] || "?"}
    </div>
  );
}

function Badge({ score }) {
  const color = score >= 90 ? "#10b981" : score >= 70 ? "#6366f1" : score >= 50 ? "#f59e0b" : "#ef4444";
  return <span style={{background:color,color:"#fff",borderRadius:12,padding:"2px 10px",fontWeight:700,fontSize:14}}>{score}</span>;
}

function MiniBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = value >= 0 ? "#6366f1" : "#ef4444";
  return (
    <div style={{background:"#e5e7eb",borderRadius:6,height:8,width:"100%",overflow:"hidden"}}>
      <div style={{width:`${pct}%`,background:color,height:"100%",borderRadius:6,transition:"width 0.4s"}} />
    </div>
  );
}

const defaultData = { students: [], records: [], classes: ["A班"] };

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultData;
    } catch { return defaultData; }
  });
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [filterClass, setFilterClass] = useState("全部");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type="success") => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 2500);
  };

  const update = useCallback((newData) => {
    setData(newData);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newData)); } catch {}
  }, []);

  const { students, records, classes } = data;
  const getScore = (id) => records.filter(r=>r.studentId===id).reduce((s,r)=>s+r.delta,0);
  const getRecords = (id) => records.filter(r=>r.studentId===id).sort((a,b)=>b.ts-a.ts);
  const filteredStudents = filterClass === "全部" ? students : students.filter(s=>s.cls===filterClass);
  const ranked = [...filteredStudents].map(s=>({...s,score:getScore(s.id)})).sort((a,b)=>b.score-a.score);
  const maxScore = ranked.length ? Math.max(...ranked.map(s=>Math.abs(s.score)),1) : 1;

  const handleAddStudent = () => {
    if (!form.name?.trim()) return showToast("請輸入姓名","error");
    const newS = { id: Date.now().toString(), name: form.name.trim(), cls: form.cls || classes[0], colorIdx: students.length };
    update({ ...data, students: [...students, newS] });
    setModal(null); setForm({}); showToast(`已新增學生「${newS.name}」`);
  };

  const handleAddRecord = () => {
    const delta = parseInt(form.delta);
    if (!form.studentId) return showToast("請選擇學生","error");
    if (isNaN(delta) || delta === 0) return showToast("請輸入有效分數","error");
    const stu = students.find(s=>s.id===form.studentId);
    const rec = { id: Date.now().toString(), studentId: form.studentId, delta, reason: form.reason||"", ts: Date.now() };
    update({ ...data, records: [...records, rec] });
    setModal(null); setForm({}); showToast(`已為「${stu?.name}」${delta>0?"加":"扣"}${Math.abs(delta)}分`);
  };

  const handleDeleteStudent = (id) => {
    const stu = students.find(s=>s.id===id);
    if (!window.confirm(`確定刪除「${stu?.name}」及其所有紀錄？`)) return;
    update({ ...data, students: students.filter(s=>s.id!==id), records: records.filter(r=>r.studentId!==id) });
    setModal(null); showToast("已刪除學生");
  };

  const handleAddClass = () => {
    const name = form.className?.trim();
    if (!name) return showToast("請輸入班級名稱","error");
    if (classes.includes(name)) return showToast("班級已存在","error");
    update({ ...data, classes: [...classes, name] });
    setForm({}); showToast(`已新增「${name}」`);
  };

  const handleImportText = () => {
    const lines = (form.importText||"").split("\n").map(l=>l.trim()).filter(Boolean);
    if (!lines.length) return showToast("請輸入學生姓名","error");
    const cls = form.importCls || classes[0];
    const newStudents = lines.map((name,i)=>({ id: Date.now().toString()+i, name, cls, colorIdx: students.length+i }));
    update({ ...data, students: [...students, ...newStudents] });
    setModal(null); setForm({}); showToast(`已匯入 ${newStudents.length} 位學生`);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split("\n").map(l=>l.trim()).filter(Boolean);
      const start = lines[0]?.includes("姓名")||lines[0]?.includes("name") ? 1 : 0;
      const cls = form.importCls || classes[0];
      const newStudents = lines.slice(start).map((line,i)=>{
        const cols = line.split(",");
        const name = cols[0]?.trim();
        const c = cols[1]?.trim() || cls;
        return name ? { id: Date.now().toString()+i, name, cls: classes.includes(c)?c:cls, colorIdx: students.length+i } : null;
      }).filter(Boolean);
      if (!newStudents.length) return showToast("CSV 內無有效資料","error");
      update({ ...data, students: [...students, ...newStudents] });
      setModal(null); setForm({}); showToast(`已匯入 ${newStudents.length} 位學生`);
    };
    reader.readAsText(file, "UTF-8");
  };

  const tabs = [
    { id:"dashboard", label:"📊 總覽" },
    { id:"ranking", label:"🏆 排行榜" },
    { id:"records", label:"📋 紀錄" },
    { id:"manage", label:"⚙️ 管理" },
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f1f5f9",fontFamily:"'Noto Sans TC',sans-serif"}}>
      <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",padding:"16px 20px",color:"#fff",boxShadow:"0 2px 12px #6366f133"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontWeight:800,fontSize:20}}>🎓 加分統計平台</div>
            <div style={{fontSize:12,opacity:.8}}>共 {students.length} 位學生 · {records.length} 筆紀錄</div>
          </div>
          <button onClick={()=>{setModal("addRecord");setForm({})}} style={{background:"#fff",color:"#6366f1",border:"none",borderRadius:10,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:14}}>＋ 加/扣分</button>
        </div>
      </div>

      <div style={{display:"flex",background:"#fff",borderBottom:"1px solid #e5e7eb",overflowX:"auto"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"12px 4px",border:"none",background:"none",fontWeight:tab===t.id?700:400,color:tab===t.id?"#6366f1":"#64748b",borderBottom:tab===t.id?"3px solid #6366f1":"3px solid transparent",cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:"16px",maxWidth:700,margin:"0 auto"}}>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {["全部",...classes].map(c=>(
            <button key={c} onClick={()=>setFilterClass(c)} style={{padding:"4px 14px",borderRadius:20,border:"1.5px solid",borderColor:filterClass===c?"#6366f1":"#e5e7eb",background:filterClass===c?"#6366f1":"#fff",color:filterClass===c?"#fff":"#64748b",fontWeight:600,cursor:"pointer",fontSize:13}}>
              {c}
            </button>
          ))}
        </div>

        {tab==="dashboard" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
              {[
                {label:"學生人數",value:filteredStudents.length,icon:"👤"},
                {label:"總加分",value:records.filter(r=>r.delta>0&&filteredStudents.some(s=>s.id===r.studentId)).reduce((a,r)=>a+r.delta,0),icon:"⬆️"},
                {label:"總扣分",value:Math.abs(records.filter(r=>r.delta<0&&filteredStudents.some(s=>s.id===r.studentId)).reduce((a,r)=>a+r.delta,0)),icon:"⬇️"},
              ].map(c=>(
                <div key={c.label} style={{background:"#fff",borderRadius:14,padding:"14px",boxShadow:"0 1px 4px #0001",textAlign:"center"}}>
                  <div style={{fontSize:24}}>{c.icon}</div>
                  <div style={{fontWeight:800,fontSize:22,color:"#1e293b"}}>{c.value}</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>{c.label}</div>
                </div>
              ))}
            </div>
            <div style={{background:"#fff",borderRadius:14,padding:"16px",boxShadow:"0 1px 4px #0001"}}>
              <div style={{fontWeight:700,marginBottom:12,color:"#1e293b"}}>學生分數一覽</div>
              {ranked.length===0 && <div style={{color:"#94a3b8",textAlign:"center",padding:20}}>尚無學生，請先新增</div>}
              {ranked.map(s=>(
                <div key={s.id} onClick={()=>{setSelected(s);setModal("studentDetail")}} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #f1f5f9",cursor:"pointer"}}>
                  <Avatar name={s.name} color={getColor(s.colorIdx)} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,color:"#1e293b"}}>{s.name} <span style={{color:"#94a3b8",fontWeight:400,fontSize:12}}>{s.cls}</span></div>
                    <MiniBar value={s.score} max={maxScore} />
                  </div>
                  <Badge score={s.score} />
                </div>
              ))}
            </div>
            {ranked.length > 0 && (
              <div style={{background:"#fff",borderRadius:14,padding:"16px",boxShadow:"0 1px 4px #0001",marginTop:12}}>
                <div style={{fontWeight:700,marginBottom:12,color:"#1e293b"}}>分數分布（橫條圖）</div>
                {ranked.map(s=>{
                  const pct = maxScore > 0 ? Math.min(100,(Math.abs(s.score)/maxScore)*100) : 0;
                  return (
                    <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{width:60,fontSize:12,color:"#64748b",textAlign:"right",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                      <div style={{flex:1,background:"#f1f5f9",borderRadius:6,height:20,overflow:"hidden"}}>
                        <div style={{width:`${pct}%`,background:s.score>=0?"#6366f1":"#ef4444",height:"100%",borderRadius:6,transition:"width 0.4s",display:"flex",alignItems:"center",paddingLeft:6}}>
                          <span style={{color:"#fff",fontSize:11,fontWeight:700}}>{s.score>0?"+":""}{s.score}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab==="ranking" && (
          <div style={{background:"#fff",borderRadius:14,padding:"16px",boxShadow:"0 1px 4px #0001"}}>
            <div style={{fontWeight:700,marginBottom:12,color:"#1e293b"}}>🏆 班級排行榜</div>
            {ranked.length===0 && <div style={{color:"#94a3b8",textAlign:"center",padding:20}}>尚無學生</div>}
            {ranked.map((s,i)=>{
              const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
              return (
                <div key={s.id} onClick={()=>{setSelected(s);setModal("studentDetail")}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 8px",borderRadius:10,background:i<3?"#f8f7ff":"transparent",marginBottom:6,cursor:"pointer",border:i===0?"1.5px solid #6366f133":"1.5px solid transparent"}}>
                  <div style={{width:32,textAlign:"center",fontSize:i<3?22:14,fontWeight:700,color:"#94a3b8"}}>{medal||`#${i+1}`}</div>
                  <Avatar name={s.name} color={getColor(s.colorIdx)} />
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:"#1e293b"}}>{s.name}</div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{s.cls}</div>
                  </div>
                  <Badge score={s.score} />
                </div>
              );
            })}
          </div>
        )}

        {tab==="records" && (
          <div style={{background:"#fff",borderRadius:14,padding:"16px",boxShadow:"0 1px 4px #0001"}}>
            <div style={{fontWeight:700,marginBottom:12,color:"#1e293b"}}>📋 所有加扣分紀錄</div>
            {records.length===0 && <div style={{color:"#94a3b8",textAlign:"center",padding:20}}>尚無紀錄</div>}
            {[...records].sort((a,b)=>b.ts-a.ts).filter(r=>filteredStudents.some(s=>s.id===r.studentId)).map(r=>{
              const stu = students.find(s=>s.id===r.studentId);
              if(!stu) return null;
              return (
                <div key={r.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <Avatar name={stu.name} color={getColor(stu.colorIdx)} />
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,color:"#1e293b"}}>{stu.name} <span style={{color:"#94a3b8",fontWeight:400,fontSize:12}}>{stu.cls}</span></div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{r.reason||"無說明"} · {new Date(r.ts).toLocaleString("zh-TW")}</div>
                  </div>
                  <span style={{fontWeight:800,fontSize:18,color:r.delta>0?"#10b981":"#ef4444"}}>{r.delta>0?"+":""}{r.delta}</span>
                </div>
              );
            })}
          </div>
        )}

        {tab==="manage" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"#fff",borderRadius:14,padding:"16px",boxShadow:"0 1px 4px #0001"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{fontWeight:700,color:"#1e293b"}}>👤 學生管理</div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>{setModal("importStudents");setForm({importCls:classes[0]})}} style={{background:"#ede9fe",color:"#6366f1",border:"none",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:13}}>📥 匯入</button>
                  <button onClick={()=>{setModal("addStudent");setForm({cls:classes[0]})}} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:13}}>＋ 新增學生</button>
                </div>
              </div>
              {filteredStudents.length===0 && <div style={{color:"#94a3b8",textAlign:"center",padding:16}}>尚無學生</div>}
              {filteredStudents.map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <Avatar name={s.name} color={getColor(s.colorIdx)} />
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,color:"#1e293b"}}>{s.name}</div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{s.cls} · {getScore(s.id)} 分</div>
                  </div>
                  <button onClick={()=>handleDeleteStudent(s.id)} style={{background:"#fef2f2",color:"#ef4444",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>刪除</button>
                </div>
              ))}
            </div>
            <div style={{background:"#fff",borderRadius:14,padding:"16px",boxShadow:"0 1px 4px #0001"}}>
              <div style={{fontWeight:700,color:"#1e293b",marginBottom:12}}>🏫 班級管理</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                {classes.map(c=><span key={c} style={{background:"#ede9fe",color:"#6366f1",borderRadius:20,padding:"4px 14px",fontWeight:600,fontSize:13}}>{c}</span>)}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input value={form.className||""} onChange={e=>setForm({...form,className:e.target.value})} placeholder="新班級名稱" style={{flex:1,border:"1.5px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:14,outline:"none"}} />
                <button onClick={handleAddClass} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer"}}>新增</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div style={{position:"fixed",inset:0,background:"#0006",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100}} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"24px",width:"100%",maxWidth:500,maxHeight:"80vh",overflowY:"auto"}}>

            {modal==="importStudents" && <>
              <div style={{fontWeight:800,fontSize:18,marginBottom:4,color:"#1e293b"}}>📥 匯入學生名單</div>
              <div style={{fontSize:13,color:"#94a3b8",marginBottom:16}}>選擇匯入方式</div>
              <label style={{fontSize:13,color:"#64748b",fontWeight:600}}>選擇班級</label>
              <select value={form.importCls||classes[0]} onChange={e=>setForm({...form,importCls:e.target.value})} style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 14px",fontSize:15,marginTop:4,marginBottom:16,boxSizing:"border-box",outline:"none"}}>
                {classes.map(c=><option key={c}>{c}</option>)}
              </select>
              <div style={{background:"#f8f7ff",borderRadius:12,padding:"14px",marginBottom:12,border:"1.5px solid #ede9fe"}}>
                <div style={{fontWeight:700,color:"#6366f1",marginBottom:6}}>📝 貼上文字</div>
                <div style={{fontSize:12,color:"#94a3b8",marginBottom:8}}>每行一個姓名，直接貼上即可</div>
                <textarea value={form.importText||""} onChange={e=>setForm({...form,importText:e.target.value})} placeholder={"王小明\n李小華\n張大文"} rows={5} style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:14,boxSizing:"border-box",outline:"none",resize:"vertical",fontFamily:"inherit"}} />
                <button onClick={handleImportText} style={{width:"100%",background:"#6366f1",color:"#fff",border:"none",borderRadius:10,padding:"10px",fontWeight:700,fontSize:14,cursor:"pointer",marginTop:8}}>匯入文字名單</button>
              </div>
              <div style={{background:"#f0fdf4",borderRadius:12,padding:"14px",border:"1.5px solid #bbf7d0"}}>
                <div style={{fontWeight:700,color:"#10b981",marginBottom:6}}>📄 上傳 CSV 檔案</div>
                <div style={{fontSize:12,color:"#94a3b8",marginBottom:8}}>第一欄姓名，第二欄（選填）班級</div>
                <label style={{display:"block",background:"#10b981",color:"#fff",borderRadius:10,padding:"10px",fontWeight:700,fontSize:14,cursor:"pointer",textAlign:"center"}}>
                  選擇 CSV 檔案
                  <input type="file" accept=".csv,text/csv" onChange={handleImportCSV} style={{display:"none"}} />
                </label>
              </div>
            </>}

            {modal==="addStudent" && <>
              <div style={{fontWeight:800,fontSize:18,marginBottom:16,color:"#1e293b"}}>➕ 新增學生</div>
              <label style={{fontSize:13,color:"#64748b",fontWeight:600}}>姓名</label>
              <input value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="請輸入學生姓名" style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 14px",fontSize:15,marginTop:4,marginBottom:12,boxSizing:"border-box",outline:"none"}} />
              <label style={{fontSize:13,color:"#64748b",fontWeight:600}}>班級</label>
              <select value={form.cls||classes[0]} onChange={e=>setForm({...form,cls:e.target.value})} style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 14px",fontSize:15,marginTop:4,marginBottom:20,boxSizing:"border-box",outline:"none"}}>
                {classes.map(c=><option key={c}>{c}</option>)}
              </select>
              <button onClick={handleAddStudent} style={{width:"100%",background:"#6366f1",color:"#fff",border:"none",borderRadius:12,padding:"14px",fontWeight:800,fontSize:16,cursor:"pointer"}}>新增學生</button>
            </>}

            {modal==="addRecord" && <>
              <div style={{fontWeight:800,fontSize:18,marginBottom:16,color:"#1e293b"}}>✏️ 加分 / 扣分</div>
              <label style={{fontSize:13,color:"#64748b",fontWeight:600}}>選擇學生</label>
              <select value={form.studentId||""} onChange={e=>setForm({...form,studentId:e.target.value})} style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 14px",fontSize:15,marginTop:4,marginBottom:12,boxSizing:"border-box",outline:"none"}}>
                <option value="">-- 請選擇 --</option>
                {students.map(s=><option key={s.id} value={s.id}>{s.name}（{s.cls}）</option>)}
              </select>
              <label style={{fontSize:13,color:"#64748b",fontWeight:600}}>分數（正數加分、負數扣分）</label>
              <input type="number" value={form.delta||""} onChange={e=>setForm({...form,delta:e.target.value})} placeholder="例如：10 或 -5" style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 14px",fontSize:15,marginTop:4,marginBottom:12,boxSizing:"border-box",outline:"none"}} />
              <label style={{fontSize:13,color:"#64748b",fontWeight:600}}>原因（選填）</label>
              <input value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="例如：課堂表現優良" style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 14px",fontSize:15,marginTop:4,marginBottom:20,boxSizing:"border-box",outline:"none"}} />
              <button onClick={handleAddRecord} style={{width:"100%",background:"#6366f1",color:"#fff",border:"none",borderRadius:12,padding:"14px",fontWeight:800,fontSize:16,cursor:"pointer"}}>確認送出</button>
            </>}

            {modal==="studentDetail" && selected && (()=>{
              const stu = students.find(s=>s.id===selected.id);
              const sc = getScore(selected.id);
              const recs = getRecords(selected.id);
              return <>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                  <Avatar name={stu?.name} color={getColor(stu?.colorIdx)} />
                  <div>
                    <div style={{fontWeight:800,fontSize:18,color:"#1e293b"}}>{stu?.name}</div>
                    <div style={{fontSize:13,color:"#94a3b8"}}>{stu?.cls}</div>
                  </div>
                  <Badge score={sc} />
                </div>
                <div style={{fontWeight:700,marginBottom:8,color:"#1e293b"}}>加扣分紀錄</div>
                {recs.length===0 && <div style={{color:"#94a3b8",textAlign:"center",padding:16}}>尚無紀錄</div>}
                {recs.map(r=>(
                  <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14,color:"#1e293b"}}>{r.reason||"無說明"}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{new Date(r.ts).toLocaleString("zh-TW")}</div>
                    </div>
                    <span style={{fontWeight:800,fontSize:16,color:r.delta>0?"#10b981":"#ef4444"}}>{r.delta>0?"+":""}{r.delta}</span>
                  </div>
                ))}
                <button onClick={()=>{setModal("addRecord");setForm({studentId:selected.id})}} style={{width:"100%",background:"#6366f1",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:16}}>＋ 為此學生加/扣分</button>
              </>;
            })()}
          </div>
        </div>
      )}

      {toast && (
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"#ef4444":"#10b981",color:"#fff",borderRadius:12,padding:"12px 24px",fontWeight:700,fontSize:14,boxShadow:"0 4px 16px #0003",zIndex:200,whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
