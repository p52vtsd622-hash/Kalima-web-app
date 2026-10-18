// A recoverable first-load failure must not strand someone on a blank screen.
import('./app.mjs').catch(()=>{
  const copy={
    en:['Kalima could not open. Check your connection and try again.','Retry'],
    ar:['تعذّر فتح Kalima. تحقّق من اتصالك وحاول مرة أخرى.','إعادة المحاولة'],
    ur:['Kalima نہیں کھل سکا۔ اپنا انٹرنیٹ کنکشن دیکھیں اور دوبارہ کوشش کریں۔','دوبارہ کوشش کریں'],
    fa:['Kalima باز نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.','تلاش دوباره'],
    tr:['Kalima açılamadı. Bağlantınızı kontrol edip tekrar deneyin.','Tekrar dene'],
    ru:['Не удалось открыть Kalima. Проверьте подключение и повторите попытку.','Повторить'],
    fr:['Impossible d’ouvrir Kalima. Vérifiez votre connexion et réessayez.','Réessayer']
  };
  let language='en';try{language=JSON.parse(localStorage.getItem('kalima_prefs_v1')||'{}').appLanguage||'en';}catch{}
  const strings=copy[language]||copy.en;document.documentElement.lang=language;
  document.documentElement.dir=['ar','ur','fa'].includes(language)?'rtl':'ltr';
  const message=document.createElement('p'),retry=document.createElement('button');
  message.textContent=strings[0];message.setAttribute('role','alert');retry.textContent=strings[1];retry.onclick=()=>location.reload();
  document.querySelector('#content').replaceChildren(message,retry);
});
