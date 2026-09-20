import { ArrowLeft } from 'lucide-react'

import { BrandLogo } from '@/shared/components/brand-logo'

export function PrivacyPolicyPage() {
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
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Polityka prywatności</h1>
            <p className="text-sm leading-6 text-zinc-600">Informacje o tym, jak FURA wykorzystuje dane potrzebne do działania usługi.</p>
          </header>

          <div className="space-y-8 text-sm leading-7 text-zinc-700">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">1. Administrator danych</h2>
              <p>Administratorem danych osobowych przetwarzanych w związku z FURA jest operator usługi FURA. Kontakt z administratorem jest możliwy pod adresem <a className="font-medium text-zinc-950 underline underline-offset-4" href="mailto:kontakt@fura.info">kontakt@fura.info</a>.</p>
              <p>Jeżeli do rozpatrzenia sprawy potrzebne są dodatkowe dane, administrator poprosi o ich podanie w bezpieczny sposób.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">2. Jakie dane przetwarzamy</h2>
              <p>W zależności od sposobu korzystania z FURA możemy przetwarzać:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>dane konta: adres e-mail, wewnętrzne ID użytkownika, nazwa wyświetlana oraz informacje o aktywacji i bezpieczeństwie konta;</li>
                <li>dane techniczne: adres IP, logi żądań i błędów, informacje o przeglądarce i urządzeniu oraz informacje o sesji, takie jak identyfikator, czas utworzenia i wygaśnięcia;</li>
                <li>dane pojazdu: marka, model, rok, przebieg, VIN i numer rejestracyjny, jeżeli użytkownik zdecyduje się je wprowadzić;</li>
                <li>historię serwisową, koszty, daty, opisy, notatki, warsztat i inne informacje zapisane przez użytkownika;</li>
                <li>zdjęcia, faktury, skany i inne dokumenty dodane do historii pojazdu;</li>
                <li>treść korespondencji oraz dane potrzebne do obsługi pytań, reklamacji i zgłoszeń bezpieczeństwa.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">3. Cele przetwarzania</h2>
              <p>Dane wykorzystujemy, aby utworzyć i obsługiwać konto, uwierzytelniać użytkownika, zapisywać i wyświetlać historię pojazdów, przechowywać dokumenty, obsługiwać udostępnianie wybranych danych, wysyłać wiadomości dotyczące konta, odpowiadać na zgłoszenia oraz zapewniać bezpieczeństwo, ciągłość i rozwój usługi.</p>
              <p>Dane techniczne mogą być używane do wykrywania nadużyć, diagnozowania awarii i ochrony FURA przed nieuprawnionym dostępem.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">4. Podstawy prawne</h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>art. 6 ust. 1 lit. b RODO, gdy przetwarzanie jest potrzebne do zawarcia lub wykonania umowy o korzystanie z FURA;</li>
                <li>art. 6 ust. 1 lit. c RODO, gdy przetwarzanie wynika z obowiązku prawnego;</li>
                <li>art. 6 ust. 1 lit. f RODO, gdy przetwarzanie jest potrzebne do uzasadnionych interesów administratora, takich jak bezpieczeństwo, dochodzenie roszczeń, obsługa zgłoszeń i utrzymanie usługi;</li>
                <li>art. 6 ust. 1 lit. a RODO, gdy użytkownik udzieli zgody, na przykład na opcjonalne technologie lub komunikację niewymaganą do działania konta.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">5. Zdjęcia, dokumenty i faktury</h2>
              <p>Pliki dodane przez użytkownika są przetwarzane w celu ich technicznego zapisania, zabezpieczenia i wyświetlenia w ramach FURA. Użytkownik powinien ograniczyć pliki do potrzebnych informacji i usuwać lub zasłaniać zbędne dane osobowe, zwłaszcza dane osób trzecich.</p>
              <p>FURA nie wykorzystuje tych materiałów do własnych celów marketingowych. Szczegółowe zasady praw do przesłanych materiałów opisuje Regulamin FURA.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">6. Okres przechowywania</h2>
              <p>Dane konta, pojazdów, historii serwisowej i plików przechowujemy przez czas istnienia konta, chyba że użytkownik wcześniej je usunie albo przepisy wymagają dłuższego przechowywania. Po usunięciu konta dane są usuwane z aktywnych systemów, a kopie techniczne mogą pozostać przez czas potrzebny do ich nadpisania lub usunięcia.</p>
              <p>Dane sesji oraz tokeny bezpieczeństwa przechowujemy przez czas trwania sesji albo do ich wygaśnięcia. Dane techniczne, zgłoszenia i korespondencję przechowujemy przez czas potrzebny do zapewnienia bezpieczeństwa, obsługi sprawy i obrony przed roszczeniami.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">7. Dostawcy i odbiorcy danych</h2>
              <p>Do działania FURA korzystamy z usług podmiotów przetwarzających dane na nasze polecenie:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Render: hosting aplikacji webowej i API oraz infrastruktura produkcyjnej bazy PostgreSQL;</li>
                <li>PostgreSQL dostarczany w ramach infrastruktury Render: przechowywanie danych kont, pojazdów, historii i metadanych plików;</li>
                <li>Resend: wysyłanie wiadomości związanych z rejestracją, weryfikacją adresu e-mail, resetem hasła i bezpieczeństwem konta;</li>
                <li>dostawcy infrastruktury pomocniczej i kopii bezpieczeństwa, jeżeli są używani w danym środowisku.</li>
              </ul>
              <p>Dostawcy otrzymują tylko dane potrzebne do wykonania swoich zadań. Lista dostawców może zostać zaktualizowana wraz ze zmianą infrastruktury FURA.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">8. Transfery poza EOG</h2>
              <p>Usługi chmurowe lub pocztowe mogą wiązać się z przetwarzaniem danych poza Europejskim Obszarem Gospodarczym. Jeżeli taki transfer wystąpi, FURA stosuje odpowiedni mechanizm zgodny z RODO, w szczególności decyzję stwierdzającą odpowiedni stopień ochrony albo standardowe klauzule umowne i dodatkowe zabezpieczenia.</p>
              <p>Informacje o lokalizacji i podwykonawcach zależą od aktualnej konfiguracji dostawców infrastruktury.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">9. Prawa użytkownika</h2>
              <p>Użytkownik może żądać dostępu do swoich danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania, a w przypadkach przewidzianych prawem także przeniesienia danych. Użytkownik może sprzeciwić się przetwarzaniu opartemu na uzasadnionym interesie oraz wycofać zgodę w dowolnym momencie, bez wpływu na zgodność wcześniejszego przetwarzania.</p>
              <p>W sprawie realizacji praw napisz na <a className="font-medium text-zinc-950 underline underline-offset-4" href="mailto:kontakt@fura.info">kontakt@fura.info</a>. Możemy poprosić o informacje potrzebne do potwierdzenia tożsamości i ochrony konta.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">10. Skarga do UODO</h2>
              <p>Jeżeli użytkownik uważa, że przetwarzanie danych narusza przepisy o ochronie danych osobowych, może złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych (UODO). Wcześniejszy kontakt z FURA może pomóc szybko wyjaśnić problem, ale nie jest warunkiem złożenia skargi.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">11. Profilowanie i decyzje automatyczne</h2>
              <p>FURA obecnie nie prowadzi profilowania użytkowników ani nie podejmuje wobec nich decyzji wyłącznie w sposób zautomatyzowany, który wywoływałby skutki prawne lub podobnie istotnie wpływał na użytkownika.</p>
              <p>Jeżeli w przyszłości pojawi się profilowanie lub zautomatyzowane podejmowanie decyzji, użytkownik zostanie o tym poinformowany przed rozpoczęciem takiego przetwarzania, wraz z opisem celu, podstawy i praw użytkownika.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">12. Cookies i podobne technologie</h2>
              <p>FURA korzysta z niezbędnych cookies, local storage lub IndexedDB, aby utrzymać sesję, zapamiętać wybrane ustawienia i zapewnić prawidłowe działanie aplikacji. Technologie te mogą przechowywać identyfikator sesji, informacje o stanie logowania lub dane lokalne aplikacji.</p>
              <p>Obecnie nie używamy opcjonalnych cookies reklamowych ani analitycznych. Jeżeli zostaną dodane, będą uruchamiane zgodnie z obowiązującymi przepisami, a użytkownik otrzyma możliwość zarządzania zgodami.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">13. Zmiany Polityki prywatności</h2>
              <p>Polityka może być aktualizowana, gdy zmieni się działanie FURA, infrastruktura, prawo lub sposób przetwarzania danych. Aktualna wersja jest publikowana na tej stronie. O istotnych zmianach poinformujemy użytkownika w sposób dostępny dla jego konta.</p>
            </section>
          </div>
        </article>
      </div>
    </main>
  )
}