/**** 
 * 
 * API Version: August 2022
 * Limitations: 300 Requests per Day / 3 concurrent API Calls
 * 
****/

const pfad      = "0_userdata.0.Systemdaten.Solaranlage.";
const debug     = false;
const fetch     = require('request');

/******* ENDE DER KONFIGURATION *******/

// Datenpunkte anlegen
if( checkStates( pfad +'Konfiguration.APIKey' ) === false ) return true;

// Aktuelle Leistung ermitteln
schedule('*/5 4-22 * * *', function(){

    var Zeit        = getTime();
    const apikey    = getState( pfad +'Konfiguration.APIKey' ).val;
    const unit      = getUnits( getState( pfad +'Konfiguration.Einheit' ).val );

    let plants = getActivePlants();
    plants.forEach( function(plant){
        
        if( debug ) log('Die aktuelle Lesitung der Anlage "'+ plant +'" wird verarbeitet.');
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
                setState( pfad +'Anlagen.'+ plant +'.Erzeugung.Jetzt', Number( data ), true );

                //Ermittle maximale Leistung Heute
                if( data > getState( pfad +'Anlagen.'+ plant +'.Erzeugung.Max_Heute' ).val ) {
                    if( debug ) log( 'Die maximale Leistung heute beträgt '+ Number( data ) +' kW.' );
                    setState( pfad +'Anlagen.'+ plant +'.Erzeugung.Max_Heute', Number( data ), true );
                }
                
            }
        });

    });

});

//Energieertrag ermitteln
schedule('*/15 4-22 * * *', function(){

    var Zeit        = getTime();
    const apikey    = getState( pfad +'Konfiguration.APIKey' ).val;
    const unit      = getUnits( getState( pfad +'Konfiguration.Einheit' ).val );

    let plants = getActivePlants();
    plants.forEach( function(plant){
        
        if( debug ) log('Der Energieertrag der Anlage "'+ plant +'" wird verarbeitet.');

        let url = new Object();
        
        url['heute']    = "https://monitoringapi.solaredge.com/site/"+ plant +"/energy?timeUnit=DAY&startDate="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"&endDate="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"&api_key="+ apikey;
        url['monat']    = "https://monitoringapi.solaredge.com/site/"+ plant +"/energy?timeUnit=MONTH&endDate="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.ltm +"&startDate="+ Zeit.jahr +"-"+ Zeit.monat +"-01&api_key="+ apikey;
        url['jahr']     = "https://monitoringapi.solaredge.com/site/"+ plant +"/energy?timeUnit=YEAR&endDate="+ Zeit.jahr +"-12-31&startDate="+ Zeit.jahr +"-01-01&api_key="+ apikey;

        // Heutige Erzeugung
        fetch( url.heute , function ( err, state, body ){
            if (err) log( "Fehler aufgetreten: " + err );
            else{
                var data = JSON.parse( body );
                data = ( data.energy.values[0].value / 1000 ).toFixed(2);

                if(debug) log( 'Die Anlage hat heute '+ data +' kWh erzeugt.' );
                setState( pfad +'Anlagen.'+ plant +'.Erzeugung.Heute', Number( data ), true );
            }
        });
        
        // Monatliche Erzeugung
        fetch( url.monat , function ( err, state, body ){
            if (err) log( "Fehler aufgetreten: " + err );
            else{
                var data = JSON.parse( body );
                data = ( data.energy.values[0].value / 1000 ).toFixed(2);

                if(debug) log( 'Die Anlage hat diesen Monat '+ data +' kWh erzeugt.' );
                setState( pfad +'Anlagen.'+ plant +'.Erzeugung.Monat', Number( data ), true );
            }
        });
        
        // Jährliche Erzeugung
        fetch( url.jahr , function ( err, state, body ){
            if (err) log( "Fehler aufgetreten: " + err );
            else{
                var data = JSON.parse( body );
                data = ( data.energy.values[0].value / 1000 ).toFixed(2);

                if(debug) log( 'Die Anlage hat dieses Jahr '+ data +' kWh erzeugt.' );
                setState( pfad +'Anlagen.'+ plant +'.Erzeugung.Jahr', Number( data ), true );
            }
        });        

    });

});

// Umweltbilanz ermitteln
schedule('0 */2 4-22 * *', function(){

    var Zeit        = getTime();
    const apikey    = getState( pfad +'Konfiguration.APIKey' ).val;
    const unit      = getUnits( getState( pfad +'Konfiguration.Einheit' ).val );

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
                setState( pfad +'Anlagen.'+ plant +'.Umwelt.CO2.Gesamt', Number( co2 ), true );
                setState( pfad +'Anlagen.'+ plant +'.Umwelt.CO2.Heute', Number( co2 - getState( pfad +'Anlagen.'+ plant +'.Umwelt._Berechnung.CO2_Vortag' ).val ), true );

                if(debug) log( 'Das enspricht einer Anzahl von '+ trees +' Bäumen.' );
                setState( pfad +'Anlagen.'+ plant +'.Umwelt.Baeume.Gesamt', Number( trees ), true );
                setState( pfad +'Anlagen.'+ plant +'.Umwelt.Baeume.Heute', Number( trees - getState( pfad +'Anlagen.'+ plant +'.Umwelt._Berechnung.Baeume_Vortag' ).val ), true );
            }
        });

    })

});

//Systemdaten ermitteln
function systemdaten(){

    const apikey    = getState( pfad +'Konfiguration.APIKey' ).val;
    const unit      = getUnits( getState( pfad +'Konfiguration.Einheit' ).val );

    if( apikey !== 0 ){

        const url = "https://monitoringapi.solaredge.com/sites/list?size=5&searchText=Lyon&sortProperty=name&sortOrder=ASC&api_key="+ apikey;

        fetch( url , function ( err, state, body ){
            
            if (err) log( "Fehler aufgetreten: " + err );
            else{
                var data = JSON.parse( body );

                data.sites.site.forEach( function(anlage){

                    if( existsState( pfad +'Anlagen.'+ anlage['id'] +'.Name' ) === false ) log( 'Die Anlage "'+ anlage['name'] +'" ( ID: '+ anlage['id'] +' ) wird erstellt.' );

                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Name', anlage['name'], {read: true, write: false, type: 'string', desc: 'Bezeichnung der Anlage'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.AccountID', anlage['accountId'], {read: true, write: false, type: 'string', desc: 'Konto ID'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Status', anlage['status'], {read: true, write: false, type: 'string', desc: 'Kontostatus'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.kWp', anlage['peakPower'], {read: true, write: false, unit: 'kWp', type: 'string', desc: 'Installierte Leistung'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Update', anlage['lastUpdateTime'], {read: true, write: false, type: 'string', desc: 'Letzte aktualisierung der Daten'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Waehrung', anlage['currency'], {read: true, write: false, type: 'string', desc: 'Angegebene Währung'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Installationsdatum', anlage['installationDate'], {read: true, write: false, type: 'string', desc: 'Installationsdatum der Anlage'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Bemerkungen', anlage['notes'], {read: true, write: false, type: 'string', desc: 'Bemerkungen zur Anlage'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Typ', anlage['type'], {read: true, write: false, type: 'string', desc: 'Anlagentyp'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Oeffentlich', anlage['publicSettings'].isPublic, {read: true, write: false, type: 'boolean', desc: 'Anlage öffentlich einsehbar'} );

                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Standort.Land', anlage['location'].country, {read: true, write: false, type: 'string', desc: 'Land in dem sich die Anlage befindet'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Standort.Stadt', anlage['location'].city, {read: true, write: false, type: 'string', desc: 'Stadt in der sich die Anlage befindet'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Standort.Adresse', anlage['location'].address, {read: true, write: false, type: 'string', desc: 'Adresse an der sich die Anlage befindet'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Standort.Adresse2', anlage['location'].address2, {read: true, write: false, type: 'string', desc: 'Adresse 2 an der sich die Anlage befindet'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Standort.Postleitzahl', anlage['location'].zip, {read: true, write: false, type: 'string', desc: 'Postleitzahl an der sich die Anlage befindet'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Standort.Zeitzone', anlage['location'].timeZone, {read: true, write: false, type: 'string', desc: 'Zeitzone in der sich die Anlage befindet'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Standort.Laendercode', anlage['location'].countryCode, {read: true, write: false, type: 'string', desc: 'Ländercode an der sich die Anlage befindet'} );

                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Module.Hersteller', anlage['primaryModule'].manufacturerName, {read: true, write: false, type: 'string', desc: 'Hersteller der Solarmodule'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Module.Modelbezeichnung', anlage['primaryModule'].modelName, {read: true, write: false, type: 'string', desc: 'Modelbezeichnung der Solarmodule'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Module.Leistung', anlage['primaryModule'].maximumPower, {read: true, write: false, unit: 'W', type: 'number', desc: 'Maximale Leistung eines Moduls'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Module.Temperaturkoeffizient', anlage['primaryModule'].temperatureCoef, {read: true, write: false, unit: '%', type: 'number', desc: 'Temperaturkoeffizient eines Moduls'} );

                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Links.Bild', anlage['uris'].SITE_IMAGE, {read: true, write: false, type: 'string', desc: 'Bild der Anlage'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Links.Details', anlage['uris'].DETAILS, {read: true, write: false, type: 'string', desc: 'Link zu den Details'} );
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Links.Uebersicht', anlage['uris'].OVERVIEW, {read: true, write: false, type: 'string', desc: 'Link zur Übersicht'} );

                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Erzeugung.Jetzt', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Aktuelle Leistung'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Erzeugung.Heute', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Heute erzeugte Energie'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Erzeugung.Monat', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Diesen Monat erzeugte Energie'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Erzeugung.Jahr', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Dieses Jahr erzeugte Energie'});
                        
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Erzeugung.Max_Heute', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Maximale Leistung Heute'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Erzeugung.Max_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Maximale Leistung Gestern'});

                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt.CO2.Gesamt', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Eingesparte CO2-Emissionen'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt.CO2.Heute', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Eingesparte CO2-Emissionen'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt.CO2.Monat', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Eingesparte CO2-Emissionen'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt.CO2.Jahr', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Eingesparte CO2-Emissionen'});

                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt.Baeume.Gesamt', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt.Baeume.Heute', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt.Baeume.Monat', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt.Baeume.Jahr', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});

                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt._Berechnung.Baeume_Vortag', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Berechnungswert Bäume Gestern'});
                    createState( pfad +'Anlagen.'+ anlage['id'] +'.Umwelt._Berechnung.CO2_Vortag', 0, {read: true, write: false, type: 'number', unit: unit.unit, desc: 'Berechnungswert CO2 Gestern'});

                });

            }

        });

        // Reset Anlagen einlesen
        if( getState( pfad +'Konfiguration.AnlagenEinlesen' ).val === true ) setState( pfad +'Konfiguration.AnlagenEinlesen', false, true );

    } else log( 'Es wurde kein API Schlüssel angegeben.', "error" );

}

//Datum und Uhrzeit
function getTime(){
    
    let data = new Object();
    var d = new Date();

    data['stunde']  = ( '0'+ d.getHours() ).substr(-2);
    data['minute']  = ( '0'+ d.getMinutes() ).substr(-2);
    data['sekunde'] = ( '0'+ d.getSeconds() ).substr(-2);;
    data['tag']     = d.getDate();
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
    let cache = $('channel[state.id='+ pfad +'Anlagen.*.Status]');

    cache.each(function(obj){
        if( existsState( obj ) && getState( obj ).val == 'Active' ){
            var id = obj.split(".");
            anlagen.push( id[ (id.length-2) ] );
        }
    });

    return anlagen;

};

// Tägliche Jobs
schedule('0 0 * * *', function () {

    let plants = getActivePlants();
    plants.forEach( function(plant){

        if(debug) log( 'Setze Berechnungsdaten für die Anlage '+ plant );

        setState( pfad +'Anlagen.'+ plant +'.Erzeugung.Max_Gestern', getState( pfad +'Anlagen.'+ plant +'.Erzeugung.Max_Heute' ).val, true );  
        setState( pfad +'Anlagen.'+ plant +'.Umwelt._Berechnung.Baeume_Vortag', getState( pfad +'Anlagen.'+ plant +'.Umwelt.Baeume.Gesamt' ).val, true );
        setState( pfad +'Anlagen.'+ plant +'.Umwelt._Berechnung.CO2_Vortag', getState( pfad +'Anlagen.'+ plant +'.Umwelt.CO2.Gesamt' ).val, true );

        //Zähler zurücksetzen
        setState( pfad +'Anlagen.'+ plant +'.Erzeugung.Max_Heute', 0, true );

        //Anlagendaten einlesen
        systemdaten();
    
    });

});

// Monatliche Jobs
schedule('0 0 1 * *', function () {

});

//Datenpunkte prüfen
function checkStates( state ){

    if( existsState( state ) === false ){

        log('Initialeinreichtung wird durchgeführt. Bitte den API Key in der Konfiguration eingeben.', 'warn');
        createStates( pfad );
        return false;

    } else return true;

};

// Anlagen einlesen wenn erzwungen
schedule('* * * * *', function(){
    if( getState( pfad +'Konfiguration.AnlagenEinlesen' ).val === true ) systemdaten();
});

//Datenpunkte erstellen
function createStates( pfad ){

    let einheiten = ['Metrisch', 'Imperial'];

    createState( pfad +'Konfiguration.APIKey', 0, {read: true, write: true, type: 'string', desc: 'Solaredge API Schlüssel'});
    createState( pfad +'Konfiguration.AnlagenEinlesen', true, {read: true, write: true, type: 'boolean', desc: 'Anlagen neu einlesen'});
    createState( pfad +'Konfiguration.Einheit', 0, {read: true, write: true, type: 'number', desc: 'Metrische oder Imperiale Einheiten', states: einheiten});
    
}
