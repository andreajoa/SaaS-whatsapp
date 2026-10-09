"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Contact {id:string;name:string|null;display_name:string|null;phone_number:string|null;exclusion:string|null}
interface Template {id:string;name:string;language:string;fields:{key:string;label:string;expects:string}[]}
interface Options {sessions:{id:string;display_name:string|null;status:string}[];templates:Template[];contacts:Contact[]}
interface Recipient {id:string;name:string|null;display_name:string|null;status:string;last_error:string|null;safe_to_retry:boolean;conversation_id:string;message_id:string|null;delivery_status:string|null;error_message:string|null;attempts:number}
interface Campaign {id:string;name:string;status:string;counts:Record<string,number>;scheduled_at:string|null;recipients?:Recipient[]}
interface Preview {body:string;eligible_count:number;excluded_count:number;audience:(Contact&{exclusion:string|null})[]}
const labels:Record<string,string>={draft:"Rascunho",scheduled:"Agendada",running:"Em andamento",paused:"Pausada",completed:"Concluída",cancelled:"Cancelada",pending:"Pendente",sending:"Enviando",sent:"Enviada",failed:"Falhou",needs_review:"Precisa de revisão",delivered:"Entregue",read:"Lida",queued:"Em fila"};
const fieldClass="w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
async function api<T>(url:string,body?:unknown):Promise<T> {
  const response=await fetch(url,body===undefined?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error?.message??"Não foi possível concluir a operação.");
  return result.data as T;
}
export default function CampaignManager({canManage}:{canManage:boolean}) {
  const t=useT();
  const locale=useTagDeIdioma();
  function templateFieldLabel(label:string) {
    const separator=label.indexOf(" · ");
    if(separator<0) return label;
    const address=label.slice(0,separator);
    const translated=address==="cabeçalho"?t("cabeçalho"):address==="corpo"?t("corpo"):address.startsWith("botão ")?`${t("botão")}${address.slice(5)}`:address;
    return translated+label.slice(separator);
  }
  const [campaigns,setCampaigns]=useState<Campaign[]>([]),[options,setOptions]=useState<Options>({sessions:[],templates:[],contacts:[]});
  const [session,setSession]=useState(""),[templateId,setTemplateId]=useState(""),[name,setName]=useState("");
  const [values,setValues]=useState<Record<string,string>>({}),[selected,setSelected]=useState<string[]>([]);
  const [search,setSearch]=useState(""),[delay,setDelay]=useState(5),[preview,setPreview]=useState<Preview|null>(null);
  const [detail,setDetail]=useState<Campaign|null>(null),[schedule,setSchedule]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true),[confirmLaunch,setConfirmLaunch]=useState(false);
  const [reviewRecipient,setReviewRecipient]=useState<string|null>(null);
  const requestVersion=useRef(0);
  const detailId=detail?.id;
  const template=options.templates.find(t=>t.id===templateId);
  const refresh=useCallback(async()=>{setCampaigns(await api<Campaign[]>("/api/v1/campaigns"));},[]);
  useEffect(()=>{ let active=true;Promise.all([api<Campaign[]>("/api/v1/campaigns"),api<Options>("/api/v1/campaigns/options")]).then(([c,o])=>{if(active){setCampaigns(c);setOptions(o);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  useEffect(()=>{
    if(!detailId) return;
    let active=true;
    const timer=setInterval(()=>{Promise.all([api<Campaign>(`/api/v1/campaigns/${detailId}`),api<Campaign[]>("/api/v1/campaigns")]).then(([d,c])=>{if(active){setDetail(d);setCampaigns(c);}}).catch(e=>{if(active)setError(e.message);});},5000);
    return()=>{active=false;clearInterval(timer);};
  },[detailId]);
  async function perform(fn:()=>Promise<void>) {setBusy(true);setError("");setNotice("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"Falha na campanha.");}finally{setBusy(false);}}
  async function changeSession(id:string) {
    const version=++requestVersion.current;setSession(id);setTemplateId("");setValues({});setSelected([]);setPreview(null);
    setOptions(o=>({...o,templates:[],contacts:[]}));
    await perform(async()=>{const o=await api<Options>(`/api/v1/campaigns/options?channel_session_id=${id}`);if(version===requestVersion.current)setOptions(o);});
  }
  function invalidate() {setPreview(null);}
  async function openCampaign(id:string) {await perform(async()=>{setDetail(await api<Campaign>(`/api/v1/campaigns/${id}`));setConfirmLaunch(false);setSchedule("");});}
  async function action(action:string,recipientId?:string) {
    if(!detail) return;
    await perform(async()=>{
      await api(`/api/v1/campaigns/${detail.id}/actions`,{action,...(["launch","retry","resolve_review"].includes(action)?{confirm:true}:{}),...(action==="resolve_review"?{resolution:"skip"}:{}),...(action==="launch"&&schedule?{scheduled_at:new Date(schedule).toISOString()}:{}),...(recipientId?{recipient_id:recipientId}:{})});
      setDetail(await api<Campaign>(`/api/v1/campaigns/${detail.id}`));await refresh();setConfirmLaunch(false);
      setReviewRecipient(null);
      setNotice(action==="retry"?t("Tentativa preparada. Retome a campanha para enviar."):action==="resolve_review"?t("Revisão encerrada. Retome os destinatários pendentes quando estiver pronto."):t("Campanha atualizada."));
    });
  }
  const shownContacts=options.contacts.filter(c=>`${c.display_name??c.name??""} ${c.phone_number??""}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
    <header><h1 className="text-2xl font-semibold tracking-tight">{t("Campanhas de WhatsApp")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("Selecione contatos com opt-in, confira o modelo aprovado e acompanhe cada envio.")}</p></header>
    {error&&<p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{t(error)}</p>}
    {notice&&<p role="status" className="rounded-md border p-3 text-sm">{notice}</p>}
    {loading&&<p role="status">{t("Carregando campanhas…")}</p>}
    {!canManage&&<p className="text-sm text-muted-foreground">{t("Você pode acompanhar as campanhas. Criar e disparar requer permissão de gerente e acompanhamento com acesso completo.")}</p>}
    {canManage&&<section aria-label={t("Nova campanha")} className="space-y-5 rounded-lg border bg-card p-5">
      <h2 className="text-lg font-medium">{t("Preparar campanha")}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="campaign-name">{t("Nome da campanha")}</Label><Input id="campaign-name" value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></div>
        <div className="space-y-2"><Label htmlFor="campaign-channel">{t("Canal")}</Label><select id="campaign-channel" className={fieldClass} disabled={busy} value={session} onChange={e=>{if(e.target.value)void changeSession(e.target.value);}}><option value="">{t("Escolha um canal")}</option>{options.sessions.map(s=><option key={s.id} value={s.id}>{s.display_name??t("Canal WhatsApp")} · {s.status}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="campaign-template">{t("Modelo aprovado")}</Label><select id="campaign-template" className={fieldClass} disabled={!session||busy} value={templateId} onChange={e=>{setTemplateId(e.target.value);setValues({});invalidate();}}><option value="">{t("Escolha um modelo")}</option>{options.templates.map(t=><option key={t.id} value={t.id}>{t.name} · {t.language}</option>)}</select></div>
      </div>
      {session&&!options.templates.length&&!busy&&<p className="text-sm text-muted-foreground">{t("Este canal não tem modelos aprovados sincronizados. Atualize os modelos na Central de Conexões.")}</p>}
      {template&&<div className="grid gap-4 md:grid-cols-2">{template.fields.map((f,i)=><div key={`${f.key}-${i}`} className="space-y-2"><Label htmlFor={`slot-${i}`}>{templateFieldLabel(f.label)}</Label><Input id={`slot-${i}`} type={["image","video","document"].includes(f.expects)?"url":"text"} value={values[f.key]??""} onChange={e=>{setValues(v=>({...v,[f.key]:e.target.value}));invalidate();}}/></div>)}</div>}
      <div className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-3"><div className="space-y-2"><Label htmlFor="campaign-search">{t("Buscar contatos existentes")}</Label><Input id="campaign-search" value={search} onChange={e=>setSearch(e.target.value)}/></div><p className="text-sm">{selected.length}{t(" selecionados · ")}{options.contacts.filter(c=>!c.exclusion).length}{t(" elegíveis na lista")}</p></div>
        <p className="text-xs text-muted-foreground">{t("A lista mostra até 500 contatos. Marque explicitamente quem deve receber. Consentimento e bloqueio serão conferidos novamente antes do envio.")}</p>
        <div className="max-h-64 overflow-auto rounded-md border">{shownContacts.map(c=><label key={c.id} className="flex items-center gap-3 border-b p-3 text-sm last:border-0"><input type="checkbox" disabled={!!c.exclusion||busy} checked={selected.includes(c.id)} onChange={e=>{setSelected(ids=>e.target.checked?[...ids,c.id]:ids.filter(id=>id!==c.id));invalidate();}}/><span className="min-w-0 flex-1">{c.display_name??c.name??t("Contato")}<span className="ml-2 text-muted-foreground">{c.phone_number}</span></span>{c.exclusion&&<span className="text-xs text-muted-foreground">{t(c.exclusion)}</span>}</label>)}{!shownContacts.length&&<p className="p-4 text-sm text-muted-foreground">{t("Nenhum contato nesta lista.")}</p>}</div>
      </div>
      <div className="flex flex-wrap items-end gap-4"><div className="space-y-2"><Label htmlFor="campaign-delay">{t("Intervalo entre destinatários (segundos)")}</Label><Input id="campaign-delay" className="w-32" type="number" min={5} max={3600} value={delay} onChange={e=>setDelay(Number(e.target.value))}/></div><Button variant="outline" disabled={busy||!templateId||!selected.length} onClick={()=>void perform(async()=>{setPreview(await api<Preview>("/api/v1/campaigns/preview",{channel_session_id:session,template_id:templateId,template_values:values,contact_ids:selected}));})}>{t("Pré-visualizar seleção")}</Button></div>
      {preview&&<div className="space-y-3 rounded-md bg-muted p-4"><p className="text-sm">{preview.eligible_count}{t(" elegíveis · ")}{preview.excluded_count}{t(" excluídos")}</p><p className="whitespace-pre-wrap text-sm">{preview.body}</p>{preview.audience.filter(c=>c.exclusion).map(c=><p key={c.id} className="text-sm text-destructive">{c.display_name??c.name??t("Contato")}: {t(c.exclusion??"")}</p>)}<Button disabled={busy||!name.trim()||!!preview.excluded_count||!preview.eligible_count} onClick={()=>void perform(async()=>{const created=await api<Campaign>("/api/v1/campaigns",{name,channel_session_id:session,template_id:templateId,template_values:values,contact_ids:selected,delay_seconds:delay});await refresh();setDetail(await api<Campaign>(`/api/v1/campaigns/${created.id}`));setPreview(null);setName("");setSelected([]);setNotice(t("Rascunho salvo. Confira os destinatários e confirme o disparo."));})}>{t("Salvar rascunho")}</Button></div>}
    </section>}
    <section aria-label={t("Campanhas")} className="space-y-3"><h2 className="text-lg font-medium">{t("Suas campanhas")}</h2>{!loading&&!campaigns.length&&<p className="text-sm text-muted-foreground">{t("Nenhuma campanha criada.")}</p>}<div className="grid gap-3 md:grid-cols-2">{campaigns.map(c=><button key={c.id} disabled={busy} className="rounded-lg border bg-card p-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" onClick={()=>void openCampaign(c.id)}><div className="flex justify-between gap-3"><span className="font-medium">{c.name}</span><span className="text-sm text-muted-foreground">{t(labels[c.status]??c.status)}</span></div><p className="mt-2 text-xs text-muted-foreground">{Object.entries(c.counts).map(([k,v])=>`${t(labels[k]??k)}: ${v}`).join(" · ")}</p></button>)}</div></section>
    {detail&&<section aria-label={t("Detalhes da campanha")} className="space-y-4 rounded-lg border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-medium">{detail.name}</h2><p className="text-sm text-muted-foreground">{t(labels[detail.status]??detail.status)}{detail.scheduled_at?` · ${new Date(detail.scheduled_at).toLocaleString(locale)}`:""}</p></div><Button variant="ghost" onClick={()=>setDetail(null)}>{t("Fechar detalhes")}</Button></div>
      <div className="flex flex-wrap gap-4 text-sm">{Object.entries(detail.counts).map(([k,v])=><span key={k}>{k.startsWith("delivery_")?`${t("Entrega: ")}${t(labels[k.slice(9)]??k.slice(9))}`:t(labels[k]??k)} <strong>{v}</strong></span>)}</div>
      {canManage&&<div className="flex flex-wrap items-center gap-3">
        {detail.status==="draft"&&<><div className="space-y-1"><Label htmlFor="campaign-schedule">{t("Agendar (opcional)")}</Label><Input id="campaign-schedule" type="datetime-local" value={schedule} onChange={e=>{setSchedule(e.target.value);setConfirmLaunch(false);}}/></div><Button disabled={busy} onClick={()=>setConfirmLaunch(true)}>{t("Revisar disparo")}</Button></>}
        {["scheduled","running"].includes(detail.status)&&<Button variant="outline" disabled={busy} onClick={()=>void action("pause")}>{t("Pausar")}</Button>}
        {detail.status==="paused"&&<Button disabled={busy} onClick={()=>void action("resume")}>{t("Retomar pendentes")}</Button>}
        {["draft","scheduled","running","paused"].includes(detail.status)&&<Button variant="outline" disabled={busy} onClick={()=>void action("cancel")}>{t("Cancelar campanha")}</Button>}
      </div>}
      {canManage&&confirmLaunch&&detail.status==="draft"&&<div className="space-y-3 rounded-md border p-4"><p className="text-sm">{t("Confirme o envio para ")}{detail.counts.pending??0}{t(" contatos explicitamente selecionados")}{schedule?`${t(" em ")}${new Date(schedule).toLocaleString(locale)}`:t(" a partir de agora")}{t(". O intervalo e as regras do canal serão respeitados.")}</p><div className="flex gap-3"><Button disabled={busy} onClick={()=>void action("launch")}>{t("Confirmar e ")}{t(schedule?"agendar":"disparar")}</Button><Button variant="ghost" onClick={()=>setConfirmLaunch(false)}>{t("Voltar")}</Button></div></div>}
      {(detail.counts.needs_review??0)>0&&<p className="rounded-md bg-muted p-3 text-sm">{t("Há envios sem confirmação segura. Confira a conversa e a entrega antes de continuar. Esses destinatários não podem ser reenviados pela campanha.")}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{t("Destinatários, tentativas e entrega")}</caption><thead><tr className="border-b"><th className="p-2">{t("Contato")}</th><th className="p-2">{t("Tentativas")}</th><th className="p-2">{t("Envio / entrega")}</th><th className="p-2">{t("Próximo passo")}</th></tr></thead><tbody>{detail.recipients?.map(r=><tr key={r.id} className="border-b last:border-0"><td className="p-2">{r.display_name??r.name??t("Contato")}</td><td className="p-2">{r.attempts}</td><td className="p-2"><p>{t(labels[r.status]??r.status)}{r.delivery_status?` · ${t(labels[r.delivery_status]??r.delivery_status)}`:""}</p>{(r.error_message||r.last_error)&&<p className="mt-1 max-w-md break-words text-xs text-destructive">{t(r.error_message??r.last_error??"")}</p>}</td><td className="space-y-2 p-2"><Link className="block underline" href={`/app/inbox?id=${r.conversation_id}`}>{t("Abrir conversa")}</Link>{canManage&&r.status==="failed"&&r.safe_to_retry&&["paused","completed"].includes(detail.status)&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void action("retry",r.id)}>{t("Preparar nova tentativa segura")}</Button>}{canManage&&r.status==="needs_review"&&["paused","completed","cancelled"].includes(detail.status)&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>setReviewRecipient(r.id)}>{t("Encerrar revisão sem reenviar")}</Button>}</td></tr>)}</tbody></table></div>
    </section>}
    <AlertDialog open={reviewRecipient!==null} onOpenChange={open=>{if(!open)setReviewRecipient(null);}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Encerrar revisão deste destinatário?")}</AlertDialogTitle>
          <AlertDialogDescription>{t("Confira a conversa e o recibo de entrega antes de confirmar. O destinatário será retirado dos pendentes e este envio não será repetido. Uma confirmação tardia ainda poderá atualizar o histórico.")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("Voltar")}</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={()=>{if(reviewRecipient)void action("resolve_review",reviewRecipient);}}>{t("Confirmar encerramento da revisão")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>;
}
