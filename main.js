/**** 
 * 
 * API Version: August 2022
 * Limitations: 300 Requests per Day / 3 concurrent API Calls
 * 
****/

const pfad      = "0_userdata.0.Systemdaten.Solaredge";
const debug     = false;
const fetch     = require('request');

/******* ENDE DER KONFIGURATION *******/

// Datenpunkte anlegen
if( checkStates( pfad +'.Konfiguration.APIKey', 'Initaleinrichtung' ) === false ) return true;

// Aktuelle Leistung ermitteln
schedule('* * * * *', function(){

    var Zeit        = getTime();
    const apikey    = getState( pfad +'.Konfiguration.APIKey' ).val;
    const unit      = getUnits( getState( pfad +'.Konfiguration.Einheit' ).val );

    let plants = getActivePlants();
    plants.forEach( function(plant){

        if( debug ) log('Die aktuelle Lesitung der Anlage "'+ plant +'" wird verarbeitet.');
        
        if( getState( pfad +'.Anlagen.'+ plant +'.Geraete.Energiezaehler').val == false ){ // Aktuelle Leistung PV ohne Energiezähler
            
            var url = "https://monitoringapi.solaredge.com/site/"+ plant +"/power?startTime="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"%2000:00:00&endTime="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"%2023:59:00&api_key="+ apikey;

            fetch( url , function ( err, state, body ){
        
                if (err) log( "Fehler aufgetreten: " + err, "error" );
                else{
                    
                    var data = JSON.parse( body );
                    data = data.power.values.filter(function(jsonObject) {
                        return jsonObject.value != null;
                    });

                    var l = data.length -1;
                    data = ( data[l].value / 1000 ).toFixed(2);

                    if( debug ) log( 'Die Anlage erzeugt derzeit '+ Number( data ) +' kW.' );
                    setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.Erzeugung.Jetzt', Number( data ), true );

                    //Ermittle maximale Leistung Heute
                    if( data > getState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.Erzeugung.Max_Heute' ).val ) {
                        if( debug ) log( 'Die maximale Leistung heute beträgt '+ Number( data ) +' kW.' );
                        setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.Erzeugung.Max_Heute', Number( data ), true );
                    }
                    
                }
            });

        } else { // Aktuelle Leistung mit Energiezähler

            var url = 'https://monitoringapi.solaredge.com/site/'+ plant +'/currentPowerFlow?api_key='+ apikey;

            fetch( url , function ( err, state, body ){
        
                if (err) log( "Fehler aufgetreten: " + err, "error" );
                else{
                    
                    var data    = JSON.parse( body );

                    setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.Erzeugung.Jetzt', data.siteCurrentPowerFlow.PV.currentPower, true );
                    setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.Gesamtverbrauch.Jetzt', data.siteCurrentPowerFlow.LOAD.currentPower, true );
                    setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.Netzbezug.Jetzt', data.siteCurrentPowerFlow.GRID.currentPower, true );

                }

            });


        }

    });

});

//Energieertrag ermitteln
schedule('*/15 * * * *', function(){

    var Zeit        = getTime();
    const apikey    = getState( pfad +'.Konfiguration.APIKey' ).val;
    const unit      = getUnits( getState( pfad +'.Konfiguration.Einheit' ).val );

    let plants = getActivePlants();
    plants.forEach( function(plant){
        
        if( debug ) log('Der Energieertrag der Anlage "'+ plant +'" wird verarbeitet.');
        var url = "https://monitoringapi.solaredge.com/site/"+ plant +"/energyDetails?timeUnit=DAY&startTime="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"%2000:00:00&endTime="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"%2023:59:59&api_key="+ apikey;

        fetch( url , function ( err, state, body ){
            if (err) log( "Fehler aufgetreten: " + err );
            else{
                
                var data = JSON.parse( body );

                data.energyDetails.meters.forEach( function( meters ){
                    
                    var dp;

                    if( meters.type == "Production" )           dp = "Erzeugung";
                    else if( meters.type == "SelfConsumption" ) dp = "Direktverbrauch";
                    else if( meters.type == "Purchased" )       dp = "Netzbezug";
                    else if( meters.type == "FeedIn" )          dp = "Einspeisung";
                    else if( meters.type == "Consumption" )     dp = "Gesamtverbrauch";

                    if( typeof dp !== 'undefined' ){                        
                        
                        //Heute
                        var production = ( meters.values[0].value / 1000 ).toFixed(2);
                        setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'.Heute', Number( production ), true );

                        //Monatlich
                        var calc = Number( getState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'._Berechnung.Monat_Gestern' ).val ) + Number( production );
                        setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'.Monat', Number( calc ), true );

                        //Jährlich
                        var calc = Number( getState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'._Berechnung.Jahr_Gestern' ).val ) + Number( production );
                        setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'.Jahr', Number( calc ), true );

                        //Gesamt
                        var calc = Number( getState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'._Berechnung.Gesamt_Gestern' ).val ) + Number( production );
                        setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'.Gesamt', Number( calc ), true );

                    } else log( 'Nicht ausgewertet: '+ meters.type, 'warn' );

                })
            }
        }); 

    });

});

// Batteriestatus ermitteln
schedule('*/5 * * * *', function(){

    var Zeit        = getTime();
    const apikey    = getState( pfad +'.Konfiguration.APIKey' ).val;
    const unit      = getUnits( getState( pfad +'.Konfiguration.Einheit' ).val );

    let plants = getActivePlants();
    plants.forEach( function(plant){

        if( getState( pfad +'.Anlagen.'+ plant +'.Geraete.Speicher' ).val == true ){

            var url = "https://monitoringapi.solaredge.com/site/2712611/storageData?startTime="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"%2000:00:00&endTime="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"%2023:59:59&api_key="+ apikey;

            fetch( url , function ( err, state, body ){
            
                if (err) log( "Fehler aufgetreten: " + err );
                else{

                    var data    = JSON.parse( body );
                    var count   = data.storageData.batteryCount;

                    for (let i = 0; i < count; i++) {
                        
                        var storage = data.storageData.batteries[i];

                        if( checkStates( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Modellbezeichnung' ) == false ) createStorageData( plant, storage.serialNumber );                            
                        else{

                            var telemetries = storage.telemetries.length -1;
                            
                            var status;
                            var nameplate   = storage.nameplate;
                            var power       = ( storage.telemetries[telemetries].power / 1000 ).toFixed(2);
                            var soh         = ( ( storage.telemetries[telemetries].fullPackEnergyAvailable / parseInt( nameplate ) ) * 100 ).toFixed(0);
                            var efficiency  = ( ( storage.telemetries[telemetries].lifeTimeEnergyDischarged / storage.telemetries[telemetries].lifeTimeEnergyCharged ) * 100 ).toFixed(0);

                            if( parseFloat(power) > 0 ) status = 1;
                            else if( parseFloat(power) < 0 ) status = 2;
                            else status = 0;

                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Modellbezeichnung', storage.modelNumber, true );
                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Kapazitaet', Number( ( storage.telemetries[telemetries].fullPackEnergyAvailable / 1000 ).toFixed(2) ), true );
                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Wirkungsgrad', Number( efficiency ) , true );                            
                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.SOH', Number( soh ), true );
                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Temperatur', storage.telemetries[telemetries].internalTemp, true );

                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Energie', Number( power ), true );
                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Status', status, true );
                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Ladung', storage.telemetries[telemetries].batteryPercentageState, true );
                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Gesamt_Entladen', Number( ( storage.telemetries[telemetries].lifeTimeEnergyDischarged / 1000 ).toFixed(2) ), true );
                            setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'.Gesamt_Geladen', Number( ( storage.telemetries[telemetries].lifeTimeEnergyCharged / 1000 ).toFixed(2) ), true );

                            if( getState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'._Berechnung.Entladen_Jahresanfang' ).val == 0 ) setState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ storage.serialNumber +'._Berechnung.Entladen_Jahresanfang', Number( ( storage.telemetries[telemetries].lifeTimeEnergyDischarged / 1000 ).toFixed(2) ), true );


                        }

                    }

                }
            
            });


        }

    });

});

// Umweltbilanz ermitteln
schedule('0 */2 * * *', function(){

    var Zeit        = getTime();
    const apikey    = getState( pfad +'.Konfiguration.APIKey' ).val;
    const unit      = getUnits( getState( pfad +'.Konfiguration.Einheit' ).val );

    let plants = getActivePlants();
    plants.forEach( function(plant){
        
        if( debug ) log('Die Umweltbilanz der Anlage "'+ plant +'" wird verarbeitet.');
        var url = "https://monitoringapi.solaredge.com/site/"+ plant +"/envBenefits?systemUnits="+ unit.api +"&api_key="+ apikey
        
        fetch( url , function ( err, state, body ){
            if (err) log( "Fehler aufgetreten: " + err );
            else{
                var data = JSON.parse( body );
                var co2     = data.envBenefits.gasEmissionSaved.co2.toFixed(2);
                var trees   = data.envBenefits.treesPlanted.toFixed(2);

                if(debug) log( 'Die Anlage hat bislang '+ co2 +' '+ unit.unit +' eingespart.' );
                setState( pfad +'.Anlagen.'+ plant +'.Umwelt.CO2.Gesamt', Number( co2 ), true );
                setState( pfad +'.Anlagen.'+ plant +'.Umwelt.CO2.Heute', Number( co2 - getState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.CO2_Vortag' ).val ), true );
                setState( pfad +'.Anlagen.'+ plant +'.Umwelt.CO2.Monat', Number( co2 - getState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.CO2_Vormonat' ).val ), true );
                setState( pfad +'.Anlagen.'+ plant +'.Umwelt.CO2.Jahr', Number( co2 - getState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.CO2_Vorjahr' ).val ), true );

                if(debug) log( 'Das enspricht einer Anzahl von '+ trees +' Bäumen.' );
                setState( pfad +'.Anlagen.'+ plant +'.Umwelt.Baeume.Gesamt', Number( trees ), true );
                setState( pfad +'.Anlagen.'+ plant +'.Umwelt.Baeume.Heute', Number( trees - getState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.Baeume_Vortag' ).val ), true );
                setState( pfad +'.Anlagen.'+ plant +'.Umwelt.Baeume.Monat', Number( trees - getState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.Baeume_Vormonat' ).val ), true );
                setState( pfad +'.Anlagen.'+ plant +'.Umwelt.Baeume.Jahr', Number( trees - getState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.Baeume_Vorjahr' ).val ), true );
            }
        });

    })

});

//Systemdaten ermitteln
function systemdaten(){

    const apikey    = getState( pfad +'.Konfiguration.APIKey' ).val;
    const unit      = getUnits( getState( pfad +'.Konfiguration.Einheit' ).val );

    if( apikey !== 0 ){
        
        const url = "https://monitoringapi.solaredge.com/sites/list?size=5&searchText=Lyon&sortProperty=name&sortOrder=ASC&api_key="+ apikey;

        fetch( url , function ( err, state, body ){
            
            if (err) log( "Fehler aufgetreten: " + err );
            else{
                
                var data = JSON.parse( body );

                data.sites.site.forEach( function(anlage){

                    if( existsState( pfad +'.Anlagen.'+ anlage['id'] +'.Name' ) === false ) log( 'Die Anlage "'+ anlage['name'] +'" ( ID: '+ anlage['id'] +' ) wird erstellt.' );

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Name', anlage['name'], {read: true, write: false, type: 'string', desc: 'Bezeichnung der Anlage'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.AccountID', anlage['accountId'], {read: true, write: false, type: 'number', desc: 'Konto ID'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Status', anlage['status'], {read: true, write: false, type: 'string', desc: 'Kontostatus'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.kWp', anlage['peakPower'], {read: true, write: false, unit: 'kWp', type: 'string', desc: 'Installierte Leistung'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Update', anlage['lastUpdateTime'], {read: true, write: false, type: 'string', desc: 'Letzte aktualisierung der Daten'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Waehrung', anlage['currency'], {read: true, write: false, type: 'string', desc: 'Angegebene Währung'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Installationsdatum', anlage['installationDate'], {read: true, write: false, type: 'string', desc: 'Installationsdatum der Anlage'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Bemerkungen', anlage['notes'], {read: true, write: false, type: 'string', desc: 'Bemerkungen zur Anlage'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Typ', anlage['type'], {read: true, write: false, type: 'string', desc: 'Anlagentyp'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Oeffentlich', anlage['publicSettings'].isPublic, {read: true, write: false, type: 'boolean', desc: 'Anlage öffentlich einsehbar'} );

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Standort.Land', anlage['location'].country, {read: true, write: false, type: 'string', desc: 'Land in dem sich die Anlage befindet'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Standort.Stadt', anlage['location'].city, {read: true, write: false, type: 'string', desc: 'Stadt in der sich die Anlage befindet'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Standort.Adresse', anlage['location'].address, {read: true, write: false, type: 'string', desc: 'Adresse an der sich die Anlage befindet'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Standort.Adresse2', anlage['location'].address2, {read: true, write: false, type: 'string', desc: 'Adresse 2 an der sich die Anlage befindet'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Standort.Postleitzahl', anlage['location'].zip, {read: true, write: false, type: 'string', desc: 'Postleitzahl an der sich die Anlage befindet'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Standort.Zeitzone', anlage['location'].timeZone, {read: true, write: false, type: 'string', desc: 'Zeitzone in der sich die Anlage befindet'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Standort.Laendercode', anlage['location'].countryCode, {read: true, write: false, type: 'string', desc: 'Ländercode an der sich die Anlage befindet'} );

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Module.Hersteller', anlage['primaryModule'].manufacturerName, {read: true, write: false, type: 'string', desc: 'Hersteller der Solarmodule'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Module.Modelbezeichnung', anlage['primaryModule'].modelName, {read: true, write: false, type: 'string', desc: 'Modelbezeichnung der Solarmodule'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Module.Leistung', anlage['primaryModule'].maximumPower, {read: true, write: false, unit: 'W', type: 'number', desc: 'Maximale Leistung eines Moduls'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Module.Temperaturkoeffizient', anlage['primaryModule'].temperatureCoef, {read: true, write: false, unit: '%', type: 'number', desc: 'Temperaturkoeffizient eines Moduls'} );

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Links.Bild', anlage['uris'].SITE_IMAGE, {read: true, write: false, type: 'string', desc: 'Bild der Anlage'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Links.Details', anlage['uris'].DETAILS, {read: true, write: false, type: 'string', desc: 'Link zu den Details'} );
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Links.Uebersicht', anlage['uris'].OVERVIEW, {read: true, write: false, type: 'string', desc: 'Link zur Übersicht'} );

                    //Datenpunkte für Erzeugung
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung.Jetzt', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Aktuelle Leistung'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung.Heute', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Heute erzeugte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung.Monat', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Diesen Monat erzeugte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung.Jahr', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Dieses Jahr erzeugte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung.Gesamt', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt erzeugte Energie'});                        
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung.Max_Heute', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Maximale Leistung Heute'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung.Max_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Maximale Leistung Gestern'});

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung._Berechnung.Monat_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Monat erzeugte Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung._Berechnung.Jahr_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Jahr erzeugte Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Erzeugung._Berechnung.Gesamt_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt erzeugte Energie bis gestern.'});

                    //Datenpunkte für Bezug
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Netzbezug.Jetzt', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Netzbezug Jetzt'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Netzbezug.Heute', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Heute bezogene Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Netzbezug.Monat', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Diesen Monat bezogene Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Netzbezug.Jahr', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Dieses Jahr bezogene Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Netzbezug.Gesamt', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt bezogene Energie'});

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Netzbezug._Berechnung.Monat_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Monat bezogene Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Netzbezug._Berechnung.Jahr_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Jahr bezogene Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Netzbezug._Berechnung.Gesamt_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt bezogene Energie bis gestern.'});

                    //Datenpunkte für Direktverbrauch
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Direktverbrauch.Heute', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Heute direkt genutzte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Direktverbrauch.Monat', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Diesen Monat direkt genutzte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Direktverbrauch.Jahr', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Dieses Jahr direkt genutzte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Direktverbrauch.Gesamt', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt direkt genutzte Energie'});

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Direktverbrauch._Berechnung.Monat_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Monat direkt genutzte Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Direktverbrauch._Berechnung.Jahr_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Jahr direkt genutzte Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Direktverbrauch._Berechnung.Gesamt_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt direkt genutzte Energie bis gestern.'});

                    //Datenpunkte für Einspeisung
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Einspeisung.Jetzt', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Einspeisung Jetzt'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Einspeisung.Heute', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Heute eingespeiste Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Einspeisung.Monat', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Diesen Monat eingespeiste Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Einspeisung.Jahr', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Dieses Jahr eingespeiste Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Einspeisung.Gesamt', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt eingespeiste Energie'});

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Einspeisung._Berechnung.Monat_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Monat eingespeiste Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Einspeisung._Berechnung.Jahr_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Jahr eingespeiste Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Einspeisung._Berechnung.Gesamt_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt eingespeiste Energie bis gestern.'});

                    //Datenpunkte für Gesamtverbrauch
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Gesamtverbrauch.Jetzt', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Aktuell benötigte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Gesamtverbrauch.Heute', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Heute benötigte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Gesamtverbrauch.Monat', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Diesen Monat benötigte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Gesamtverbrauch.Jahr', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Dieses Jahr benötigte Energie'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Gesamtverbrauch.Gesamt', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt benötigte Energie'});

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Gesamtverbrauch._Berechnung.Monat_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Monat benötigte Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Gesamtverbrauch._Berechnung.Jahr_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Im Jahr benötigte Energie bis gestern.'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Energiebilanz.Gesamtverbrauch._Berechnung.Gesamt_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamt benötigte Energie bis gestern.'});

                    //Datenpunkte für Benefits
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt.CO2.Gesamt', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Eingesparte CO2-Emissionen'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt.CO2.Heute', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Eingesparte CO2-Emissionen'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt.CO2.Monat', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Eingesparte CO2-Emissionen'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt.CO2.Jahr', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Eingesparte CO2-Emissionen'});

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt.Baeume.Gesamt', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt.Baeume.Heute', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt.Baeume.Monat', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt.Baeume.Jahr', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});

                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt._Berechnung.Baeume_Vortag', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Berechnungswert Bäume Gestern'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt._Berechnung.CO2_Vortag', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Berechnungswert CO2 Gestern'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt._Berechnung.Baeume_Vormonat', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Berechnungswert Bäume vorigen Monats'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt._Berechnung.CO2_Vormonat', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Berechnungswert CO2 vorigen Monats'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt._Berechnung.Baeume_Vorjahr', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Berechnungswert Bäume voriges Jahr'});
                    createState( pfad +'.Anlagen.'+ anlage['id'] +'.Umwelt._Berechnung.CO2_Vorjahr', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Berechnungswert CO2 voriges Jahr'});

                    //Installierte Geräte ermitteln
                    checkDevices( anlage['id'] );

                });

            }

        });

        // Reset Anlagen einlesen
        if( getState( pfad +'.Konfiguration.AnlagenEinlesen' ).val === true ) setState( pfad +'.Konfiguration.AnlagenEinlesen', false, true );

    } else log( 'Es wurde kein API Schlüssel angegeben.', "error" );

}

//Auf vorhandene Geräte prüfen und Datenpunkte erzeugen
function checkDevices( plant ){

    const apikey    = getState( pfad +'.Konfiguration.APIKey' ).val;

    let url = new Object();
    url['energymeter']  = "https://monitoringapi.solaredge.com/site/"+ plant +"/currentPowerFlow?api_key="+ apikey;
    url['battery']      = "https://monitoringapi.solaredge.com/site/"+ plant +"/storageData?startTime=2023-02-18%2000:00:00&endTime=2023-02-18%2023:59:59&api_key="+ apikey;

    fetch( url['energymeter'] , function ( err, state, body ){
        
        if (err) log( "Fehler aufgetreten: " + err );
        else{
                
            var data = JSON.parse( body );
            if( typeof data.siteCurrentPowerFlow.updateRefreshRate != "undefined" ) {
                
                if( checkStates( pfad +'.Anlagen.'+ plant +'.Geraete.Energiezaehler') == false ){

                    log( 'Energiezähler erkannt.', 'warn' )                    
                    createState( pfad +'.Anlagen.'+ plant +'.Geraete.Energiezaehler', true, {read: true, write: false, type: 'boolean', desc: 'Energiezähler vorhanden oder nicht.'});

                } else setState( pfad +'.Anlagen.'+ plant +'.Geraete.Energiezaehler', true );

            } else {

                if( checkStates( pfad +'.Anlagen.'+ plant +'.Geraete.Energiezaehler') == false ){

                    log( 'Keinen Energiezähler erkannt.', 'warn' )
                    createState( pfad +'.Anlagen.'+ plant +'.Geraete.Energiezaehler', false, {read: true, write: false, type: 'boolean', desc: 'Energiezähler vorhanden oder nicht.'});
                
                } else setState( pfad +'.Anlagen.'+ plant +'.Geraete.Energiezaehler', false );

            }

        }

    })

    fetch( url['battery'] , function ( err, state, body ){
        
        if (err) log( "Fehler aufgetreten: " + err );
        else{
                
            var data = JSON.parse( body );
            if( data.storageData.batteryCount > 0 ) {
                
                if( checkStates( pfad +'.Anlagen.'+ plant +'.Geraete.Speicher') == false ){

                    log( 'Speicher erkannt.', 'warn' )                    
                    createState( pfad +'.Anlagen.'+ plant +'.Geraete.Speicher', true, {read: true, write: false, type: 'boolean', desc: 'Batterie vorhanden oder nicht.'});

                } else setState( pfad +'.Anlagen.'+ plant +'.Geraete.Speicher', true, true );

            } else {

                if( checkStates( pfad +'.Anlagen.'+ plant +'.Geraete.Speicher') == false ){

                    log( 'Keine Batterie erkannt.', 'warn' )
                    createState( pfad +'.Anlagen.'+ plant +'.Geraete.Speicher', false, {read: true, write: false, type: 'boolean', desc: 'Batterie vorhanden oder nicht.'});
                
                } else setState( pfad +'.Anlagen.'+ plant +'.Geraete.Speicher', false, true );

            }

        }

    })

}

function createEnergyCounter( plant ){
    
}

function createStorageData( plant, serialnumber ){

    log( 'Erstelle Datenpunkte für den Speicher mit der Seriennumer: '+ serialnumber, 'warn' );

    //Datenpunkte für Batteriestatus
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Modellbezeichnung', '', {read: true, write: false, type: 'string', desc: 'Modellbezeichnung des Speichers'});
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Kapazitaet', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Maximale Kapazität des Speichers' });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.SOH', 0, {read: true, write: false, type: 'number', unit: '%', desc: 'State of Health des Speichers' });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Wirkungsgrad', 0, {read: true, write: false, type: 'number', unit: '%', desc: 'Wirkungsgrad des Speichers' });

    var status = ['StandBy', 'Laden', 'Entladen'];
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Status', 0, {read: true, write: false, type: 'number', desc: 'Status des Speichers', states: status });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Energie', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Energiefluss des Speichers, Positiv ist Aufladen, Negativ ist Entladen' });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Gesamt_Entladen', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamte Energie die aus dem Speicher bezogen wurde.' });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Gesamt_Geladen', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamte Energie die in den Speicher geladen wurde.' });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Ladung', 0, {read: true, write: false, type: 'number', unit: '%', desc: 'Aktuelle Ladung in Prozent' });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Temperatur', 0, {read: true, write: false, type: 'number', unit: '°C', desc: 'Interne Temperatur des Speichers' });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Vollzyklen_Gesamt', 0, {read: true, write: false, type: 'number', desc: 'Vollzyklen des Speichers Gesamt' });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'.Vollzyklen_Jahr', 0, {read: true, write: false, type: 'number', desc: 'Vollzyklen des Speichers in diesem Jahr' });
    createState( pfad +'.Anlagen.'+ plant +'.Speicher.'+ serialnumber +'._Berechnung.Entladen_Jahresanfang', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Gesamtentladung am Jahresanfang' });

}

//Datum und Uhrzeit
function getTime(){
    
    let data = new Object();
    var d = new Date();

    data['stunde']  = ( '0'+ d.getHours() ).substr(-2);
    data['minute']  = ( '0'+ d.getMinutes() ).substr(-2);
    data['sekunde'] = ( '0'+ d.getSeconds() ).substr(-2);;
    data['tag']     = ( '0'+ ( d.getDate() ) ).substr(-2);
    data['monat']   = ( '0'+ ( d.getMonth() +1 ) ).substr(-2);
    data['jahr']    = d.getFullYear();
    data['ltm']     = (new Date( d.getFullYear(), d.getMonth()+1, 0 )).getDate();

    return data;

}

//Einheiten auslesen
function getUnits( u ){

    var unit = new Object();
    if( u == 0 ){

        unit['api'] = "Metrics",
        unit['unit'] = "Kg"

    } else if ( u == 1 ){

        unit['api'] = "Imperial",
        unit['unit'] = "Lb"

    };

    return unit;

}

function getActivePlants(){

    let anlagen = new Array;
    let cache = $('channel[state.id='+ pfad +'.Anlagen.*.Status]');

    cache.each(function(obj){
        if( existsState( obj ) && getState( obj ).val == 'Active' ){
            var id = obj.split(".");
            anlagen.push( id[ (id.length-2) ] );
        }
    });

    return anlagen;

};

// Tägliche Jobs
schedule('59 23 * * *', function () {

    let plants = getActivePlants();
    plants.forEach( function(plant){

        if(debug) log( 'Setze tägliche Berechnungsdaten für die Anlage '+ plant );

        setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.Erzeugung.Max_Gestern', getState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.Erzeugung.Max_Heute' ).val, true );  
        setState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.Baeume_Vortag', getState( pfad +'.Anlagen.'+ plant +'.Umwelt.Baeume.Gesamt' ).val, true );
        setState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.CO2_Vortag', getState( pfad +'.Anlagen.'+ plant +'.Umwelt.CO2.Gesamt' ).val, true );

        //Monats-, Jahres- und Gesamtstatistiken schreiben
        var datenpunkte = ["Erzeugung", "Direktverbrauch", "Netzbezug", "Einspeisung", "Gesamtverbrauch"];

        datenpunkte.forEach( function( dp ){

            setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'._Berechnung.Monat_Gestern', getState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'.Monat').val, true );
            setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'._Berechnung.Jahr_Gestern', getState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'.Jahr').val, true );
            setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'._Berechnung.Gesamt_Gestern', getState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'.Gesamt').val, true );
            setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.'+ dp +'.Heute', 0, true );

        })

        //Zähler zurücksetzen
        setState( pfad +'.Anlagen.'+ plant +'.Energiebilanz.Erzeugung.Max_Heute', 0, true );

        //Anlagendaten einlesen
        systemdaten();
    
    });

});

// Monatliche Jobs
schedule('2 0 1 * *', function () {

    let plants = getActivePlants();
    plants.forEach( function(plant){

        if(debug) log( 'Setze monatliche Berechnungsdaten für die Anlage '+ plant );

        setState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.Baeume_Vormonat', getState( pfad +'.Anlagen.'+ plant +'.Umwelt.Baeume.Gesamt' ).val, true );
        setState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.CO2_Vormonat', getState( pfad +'.Anlagen.'+ plant +'.Umwelt.CO2.Gesamt' ).val, true );

        //Zähler zurücksetzen
        setState( pfad +'.Anlagen.'+ plant +'.Umwelt.Baeume.Monat', 0, true );
        setState( pfad +'.Anlagen.'+ plant +'.Umwelt.CO2.Monat', 0, true );
    
    });

});

// Jährliche Jobs
schedule('3 0 1 1 *', function () {

    let plants = getActivePlants();
    plants.forEach( function(plant){

        if(debug) log( 'Setze jährliche Berechnungsdaten für die Anlage '+ plant );

        setState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.Baeume_Vorjahr', getState( pfad +'.Anlagen.'+ plant +'.Umwelt.Baeume.Gesamt' ).val, true );
        setState( pfad +'.Anlagen.'+ plant +'.Umwelt._Berechnung.CO2_Vorjahr', getState( pfad +'.Anlagen.'+ plant +'.Umwelt.CO2.Gesamt' ).val, true );

        //Zähler zurücksetzen
        setState( pfad +'.Anlagen.'+ plant +'.Umwelt.Baeume.Jahr', 0, true );
        setState( pfad +'.Anlagen.'+ plant +'.Umwelt.CO2.Jahr', 0, true );
    
    });

});

//Datenpunkte prüfen
function checkStates( state, type='check' ){

    if( existsState( state ) === false ){

        if( type == 'Initaleinrichtung' ){
        
            log('Initialeinreichtung wird durchgeführt. Bitte den API Key in der Konfiguration eingeben.', 'warn');
            createStates( pfad );
        
        }

        return false;

    } else return true;

};

// Anlagen einlesen wenn erzwungen
schedule('* * * * *', function(){
    if( getState( pfad +'.Konfiguration.AnlagenEinlesen' ).val === true ) systemdaten();
});

//Datenpunkte erstellen
function createStates( pfad ){

    let einheiten = ['Metrisch', 'Imperial'];

    createState( pfad +'.Konfiguration.APIKey', 0, {read: true, write: true, type: 'string', desc: 'Solaredge API Schlüssel'});
    createState( pfad +'.Konfiguration.AnlagenEinlesen', true, {read: true, write: true, type: 'boolean', desc: 'Anlagen neu einlesen'});
    createState( pfad +'.Konfiguration.Einheit', 0, {read: true, write: true, type: 'number', desc: 'Metrische oder Imperiale Einheiten', states: einheiten});

    createState( pfad +'.Konfiguration.Bezugskosten', 0.32, {read: true, write: true, type: 'number', unit: 'Euro', desc: 'Preis pro kWh Bezug in Euro' });
    createState( pfad +'.Konfiguration.Einspeiseverguetung', 0.082, {read: true, write: true, type: 'number', unit: 'Euro', desc: 'Vergütung pro kWh Bezug in Euro' });
    
}
