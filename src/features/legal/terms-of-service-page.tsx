import { ArrowLeft } from 'lucide-react'

import { BrandLogo } from '@/shared/components/brand-logo'

export function TermsOfServicePage() {
  return (
    <main className="min-h-svh bg-[#f7f7f5] px-4 py-6 text-zinc-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo />
          <a className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline" href="/">
            <ArrowLeft className="h-4 w-4" />
            Wróć do FURA
          </a>
        </header>

        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
          <header className="mb-8 space-y-2 border-b border-zinc-200 pb-6">
            <p className="text-sm font-medium text-orange-700">Dokument obowiązujący od 20 września 2026 r.</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Regulamin FURA</h1>
            <p className="text-sm leading-6 text-zinc-600">Proste zasady korzystania z dziennika serwisowego FURA.</p>
          </header>

          <div className="space-y-8 text-sm leading-7 text-zinc-700">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">1. Zakres usługi</h2>
              <p>FURA jest internetowym dziennikiem historii samochodu. Usługa pozwala tworzyć profile pojazdów, zapisywać informacje o serwisie, przebiegu, kosztach i planowanych pracach oraz przechowywać i wyświetlać zdjęcia, faktury i inne dokumenty dodane przez użytkownika.</p>
              <p>FURA może udostępniać wybrane informacje lub dokumenty za pomocą funkcji wybranej przez użytkownika. Zakres udostępnienia zależy od ustawień i działania tej funkcji.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">2. Konto użytkownika</h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Do korzystania z funkcji wymagających logowania potrzebne jest konto utworzone przy użyciu prawidłowego adresu e-mail, nazwy użytkownika i hasła.</li>
                <li>Użytkownik odpowiada za zachowanie poufności hasła i za działania wykonane z jego konta.</li>
                <li>Użytkownik może usunąć konto w ustawieniach profilu. Usunięcie konta jest nieodwracalne i usuwa dane profilu, pojazdów, wpisów oraz pliki zapisane w ramach konta, z zastrzeżeniem danych, które muszą zostać zachowane na podstawie prawa lub pozostają czasowo w kopiach technicznych.</li>
                <li>FURA może ograniczyć lub zakończyć dostęp do konta, jeżeli użytkownik narusza Regulamin, prawo albo bezpieczeństwo usługi. W miarę możliwości użytkownik zostanie o tym poinformowany.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">3. Wymagania techniczne</h2>
              <p>Do korzystania z FURA potrzebne są: urządzenie z dostępem do internetu, aktualna przeglądarka internetowa z włączoną obsługą JavaScript oraz możliwość zapisywania niezbędnych plików cookie i danych lokalnych. Użytkownik powinien korzystać z aktualnego systemu i oprogramowania zabezpieczającego.</p>
              <p>Dostępność usługi może być czasowo ograniczona przez prace techniczne, awarie sieci lub działanie dostawców zewnętrznych.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">4. Dane wprowadzane przez użytkownika</h2>
              <p>Użytkownik odpowiada za prawdziwość, aktualność, kompletność i zgodność z prawem danych wprowadzanych do FURA. Wpisy w dzienniku mają charakter pomocniczy i nie zastępują dokumentacji wymaganej przez prawo, zaleceń producenta ani diagnozy wykwalifikowanego serwisu.</p>
              <p>Użytkownik powinien samodzielnie dbać o kopie ważnych informacji i dokumentów. Nie wolno wprowadzać treści naruszających prawa innych osób, zawierających złośliwe oprogramowanie ani służących do nadużywania usługi.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">5. Zdjęcia, faktury i dokumenty</h2>
              <p>Użytkownik może dodawać zdjęcia, faktury, skany i inne pliki związane z pojazdem. Przed dodaniem pliku powinien sprawdzić, czy może legalnie go przechowywać i udostępniać oraz czy plik nie zawiera danych, których FURA nie potrzebuje do działania.</p>
              <p>Nie należy przesyłać haseł, danych logowania, numerów kart płatniczych ani innych poufnych informacji niezwiązanych z historią pojazdu. Użytkownik powinien w miarę możliwości usunąć lub zasłonić zbędne dane osobowe z faktur i zdjęć.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">6. Prawa do przesłanych materiałów</h2>
              <p>Użytkownik zachowuje prawa do zdjęć, faktur, dokumentów i innych materiałów przesłanych do FURA. Przesłanie materiału nie oznacza przeniesienia jego własności ani praw autorskich na FURA.</p>
              <p>Użytkownik udziela FURA niewyłącznego prawa, bez dodatkowego wynagrodzenia, wyłącznie w zakresie potrzebnym do technicznego zapisania, zabezpieczenia, przetworzenia i wyświetlenia materiału w ramach usługi oraz funkcji udostępnienia wybranej przez użytkownika. Prawo to wygasa po usunięciu materiału lub konta, z wyjątkiem technicznego okresu usuwania kopii oraz obowiązków prawnych.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">7. Dane osób trzecich</h2>
              <p>Nie należy przesyłać niepotrzebnych danych osób trzecich. Dotyczy to w szczególności numerów telefonów, adresów, podpisów, numerów dokumentów i innych danych, które nie są potrzebne do opisania historii pojazdu. Jeżeli dodanie takich danych jest konieczne, użytkownik powinien mieć podstawę do ich przekazania i poinformowania danej osoby, gdy wymagają tego przepisy.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">8. Reklamacje i kontakt</h2>
              <p>Pytania, problemy z działaniem usługi i reklamacje można zgłaszać na adres <a className="font-medium text-zinc-950 underline underline-offset-4" href="mailto:kontakt@fura.info">kontakt@fura.info</a>. W zgłoszeniu warto podać adres e-mail konta, opis problemu, datę jego wystąpienia i sposób kontaktu. Nie należy przesyłać hasła ani innych danych logowania.</p>
              <p>FURA rozpatruje zgłoszenia bez zbędnej zwłoki i, jeżeli jest to możliwe, odpowiada w ciągu 14 dni.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">9. Rozwiązanie umowy</h2>
              <p>Umowa o korzystanie z FURA zostaje zawarta na czas nieokreślony z chwilą utworzenia konta. Użytkownik może zakończyć korzystanie z usługi w dowolnym momencie przez usunięcie konta. FURA może zakończyć świadczenie usługi lub wypowiedzieć umowę z ważnej przyczyny, w szczególności z powodu naruszenia Regulaminu, przepisów prawa albo trwałego zakończenia działania usługi.</p>
              <p>Zmiany Regulaminu będą publikowane na tej stronie. Jeżeli zmiana będzie istotna, FURA poinformuje o niej użytkownika w sposób dostępny dla konta przed jej wejściem w życie.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">10. Postanowienia końcowe</h2>
              <p>Regulamin podlega prawu polskiemu, z uwzględnieniem bezwzględnie obowiązujących praw konsumenta. Jeżeli którekolwiek postanowienie okaże się nieważne, pozostałe postanowienia pozostają w mocy.</p>
            </section>
          </div>
        </article>
      </div>
    </main>
  )
}