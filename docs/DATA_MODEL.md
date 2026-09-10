# DATA_MODEL

## Encje

### UserProfile

- `id`
- `username`
- `displayName`
- `createdAt`
- `updatedAt`

### Vehicle

- `id`
- `profileId`
- `name`
- `make`
- `model`
- `year`
- `bodyType`
- `fuelType`
- `transmission`
- `engine`
- `vin`
- `registrationNumber`
- `currentMileage`
- `imageUrl`
- `notes`
- `archived`
- `createdAt`
- `updatedAt`

### ServiceEvent

- `id`
- `profileId`
- `vehicleId`
- `status`: `completed | planned | cancelled`
- `category`
- `title`
- `eventDate`
- `mileage`
- `description`
- `workshopName`
- `workshopLocation`
- `partsCost`
- `laborCost`
- `otherCost`
- `currency`: `PLN`
- `attachmentCount`
- `createdAt`
- `updatedAt`

## Relacje

- jeden profil ma wiele aut
- jedno auto ma wiele wpisów serwisowych
- każdy wpis serwisowy należy jednocześnie do `profileId` i `vehicleId`

## Rozszerzalność

Model jest przygotowany pod przyszłe:

- osobne części i pozycje kosztowe
- załączniki i dokumenty PDF
- backend i autoryzację serwerową
- archiwizację aut