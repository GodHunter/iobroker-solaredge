# iobroker-solaredge

Dieses Script ließt alle, dem Account zugehörigen, Solaranlagen bei SolarEdge aus und gibt aktuelle Werte und Statistiken aus.

# Einrichtung

Beim ersten Start des Scripts werden die Datenpunkte unter dem in der Variable ***const pfad*** definiertem Pfad angelegt. Anschließend muss der API Schlüssel im Bereich Konfiguration eingetragen werden und ggf. die gewünschte Einheit ( Metrisch / Imperial ) gesetzt werden. Das Script ließt dann alle Anlagen des zugehörigen Kontos aus.

# Datenpunkte

###### {PFAD}.Konfiguration

- ***APIKey:*** = Hier muss der API Schlüssel eingetragen werden.
- ***AnlagenEinlesen:*** = Hiermit kann ein erneutes einlesen der Anlagen forciert werden.
- ***Einheit:*** = Hier kann zwischen metrischen oder imperialen Einheiten gewechselt werden.

###### {PFAD}.Anlagen

Hier sind alle Anlagen, die unter dem Account des zugehörigen API Keys verwaltet werden, aufgeführt.

###### {PFAD}.Erzeugung

Enthält alle relevanten Erzeugungsdaten. Momentan werden folgende Werte erfasst.

- Jetzt ( Aktuelle Leistung in kW )
- Heute ( Heutiger Energieertrag in kWh )
- Monat ( Im aktuellem Monat erzeugter Energieertrag in kWh )
- Jahr ( Im aktuellen Jahr erzeugter Energieertrag in kWh )
- Max_Gestern ( Maximale Leistung gestern in kW )
- Max_Heute ( Maximale Leistung heute in kW )

###### {PFAD}.Umwelt

Enthält alle relevanten Daten zur Umweltbilanz. Momentan werden folgende Werte erfasst.

- CO2.Gesamt ( Gesamt eingesparte CO2 Emmisionen )
- CO2.Heute ( Heute eingesparte CO2 Emmisionen )
- CO2.Monat  ( Diesen Monat eingesparte CO2 Emmisionen )
- CO2.Jahr  ( Dieses Jahr eingesparte CO2 Emmisionen )
- Baueme.Gesamt ( Gesamt äquivalent gepflanzte Bäume )
- Baueme.Heute ( Heute äquivalent gepflanzte Bäume )
- Baueme.Monat  ( Diesen Monat äquivalent gepflanzte Bäume )
- Baueme.Jahr  ( Dieses Jahr äquivalent gepflanzte Bäume )

###### Weitere Datenpunkte

Zur Anlage selbst werden Daten zum Standort und den einzelnen Modulen erfasst. Diese sind selbsterklärend.

# Support

Wenn euch meine Arbeit gefällt, würde ich mich über eine Spende auf Ko-Fi freuen. 
Vielen Dank.

https://ko-fi.com/tobstar27688
