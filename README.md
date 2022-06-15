# nakama-custom-server

Oyunun adı stay_alive_for_a_minute. Maça katılan oyuncular saniye başına puan kazanmaktadır. Bir maç süresi 60 saniyedir. En uzun süre maçta kalan oyunu kazanır.

# matchmaking

Nakama kullanarak Typescript Runtime API ile custom bir matchmaking yapısı kurulmuştur.

# maç kuralları

Maçta client limiti bulunmamaktadır.
Hazır olan client maç oluşturabilir ve maça dahil olur.
Bir maç süresi 60 saniyedir.
Client maçta ne kadar uzun süre kalırsa o kadar çok puan kazanır.
60 saniye dolduktan sonra maç sona eriyor ve clientlara puanları içeren "DONE" mesajı gönderiliyor.

# talimatlar

```s
npm install
```

```s
docker compose up
```
