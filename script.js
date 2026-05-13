const supabaseUrl = 'https://ryzaoxategadqatpocli.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emFveGF0ZWdhZHFhdHBvY2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODEwNjksImV4cCI6MjA5NDI1NzA2OX0.letvD-sgCVABNUlMMRZpANn7mitw7_Wk8S5gaZWied4';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener("DOMContentLoaded", () => {
    console.log("Шаблон DOORHUB загружен. Supabase подключена.");
});