/**** 
 * 
 * API Version: August 2022
 * Limitations: 300 Requests per Day / 3 concurrent API Calls
 * 
****/

const pfad      = "0_userdata.0.Systemdaten.Solaranlage.";
const fetch     = require('request');

/******* ENDE DER KONFIGURATION *******/

// States anlegen
checkStates( pfad +'Konfiguration.Einheit' );

//Aktuelle Leistung ermitteln
schedule('*/10 * * * *', function(){

    if( checkStates( pfad +'Konfiguration.Einheit' ) === false ) return true;

    var Zeit = getTime();
    const apikey    = getState( pfad +'Konfiguration.API-Key' ).val;
    const siteid    = getState( pfad +'Konfiguration.SiteID' ).val;
    const unit      = getUnits( getState( pfad +'Konfiguration.Einheit' ).val );

    if( apikey !== 0 && siteid != 0 ){

        var url = "https://monitoringapi.solaredge.com/site/"+ siteid +"/power?startTime="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"%2000:00:00&endTime="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"%2023:59:00&api_key="+ apikey

        fetch( url , function ( err, state, body ){
    
            if (err) log( "Fehler aufgetreten: " + err, "error" );
            else{
                
                var data = JSON.parse( body );
                data = data.power.values.filter(function(jsonObject) {
                    return jsonObject.value != null;
                });

                var l = data.length -1;
                data = ( data[l].value / 1000 ).toFixed(2);
                setState( pfad +'Erzeugung.Jetzt', Number( data ), true );

                //Ermittle maximale Leistung Heute
                if( data > getState( pfad +'Erzeugung.Jetzt' ).val ) setState( pfad +'Erzeugung.Max_Heute', Number( data ) );
                
            }
        });
    
    } else log( 'Es wurde kein API Schlüssel / keine Site ID angegeben.', "error" );

})

//Weitere Daten ermitteln
schedule('*/15 * * * *', function(){

    if( checkStates( pfad +'Konfiguration.Einheit' ) === false ) return true;

    var Zeit = getTime();
    const apikey    = getState( pfad +'Konfiguration.API-Key' ).val;
    const siteid    = getState( pfad +'Konfiguration.SiteID' ).val;
    const unit      = getUnits( getState( pfad +'Konfiguration.Einheit' ).val );

    let url = new Object();
    
    url['heute']    = "https://monitoringapi.solaredge.com/site/"+ siteid +"/energy?timeUnit=DAY&startDate="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"&endDate="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.tag +"&api_key="+ apikey
    url['monat']    = "https://monitoringapi.solaredge.com/site/"+ siteid +"/energy?timeUnit=MONTH&endDate="+ Zeit.jahr +"-"+ Zeit.monat +"-"+ Zeit.ltm +"&startDate="+ Zeit.jahr +"-"+ Zeit.monat +"-01&api_key="+ apikey
    url['jahr']     = "https://monitoringapi.solaredge.com/site/"+ siteid +"/energy?timeUnit=YEAR&endDate="+ Zeit.jahr +"-12-31&startDate="+ Zeit.jahr +"-01-01&api_key="+ apikey
    url['umwelt']   = "https://monitoringapi.solaredge.com/site/"+ siteid +"/envBenefits?systemUnits="+ unit.api +"&api_key="+ apikey

    // Heutige Erzeugung
    fetch( url.heute , function ( err, state, body ){
        if (err) log( "Fehler aufgetreten: " + err );
        else{
            var data = JSON.parse( body );
            data = ( data.energy.values[0].value / 1000 ).toFixed(2);

            setState( pfad +'Erzeugung.Heute', Number( data ), true );
        }
    });

    // Monatliche Erzeugung
    fetch( url.monat , function ( err, state, body ){
        if (err) log( "Fehler aufgetreten: " + err );
        else{
            var data = JSON.parse( body );
            data = ( data.energy.values[0].value / 1000 ).toFixed(2);

            setState( pfad +'Erzeugung.Monat', Number( data ), true );
        }
    });

    // Jährliche Erzeugung
    fetch( url.jahr , function ( err, state, body ){
        if (err) log( "Fehler aufgetreten: " + err );
        else{
            var data = JSON.parse( body );
            data = ( data.energy.values[0].value / 1000 ).toFixed(2);

            setState( pfad +'Erzeugung.Jahr', Number( data ), true );
        }
    });

    // Umwelt
    fetch( url.umwelt , function ( err, state, body ){
        if (err) log( "Fehler aufgetreten: " + err );
        else{
            var data = JSON.parse( body );
            var co2     = data.envBenefits.gasEmissionSaved.co2.toFixed(2);
            var trees   = data.envBenefits.treesPlanted.toFixed(2);

            setState( pfad +'Umwelt.CO2.Gesamt', Number( co2 ), true );
            setState( pfad +'Umwelt.CO2.Heute', Number( co2 - getState( pfad +'Umwelt._Berechnung.CO2_Vortag' ).val ), true );

            setState( pfad +'Umwelt.Baeume.Gesamt', Number( trees ), true );
            setState( pfad +'Umwelt.Baeume.Heute', Number( trees - getState( pfad +'Umwelt._Berechnung.Baeume_Vortag' ).val ), true );
        }
    });

})

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
    data['ltm']     = new Date( d.getFullYear(), d.getMonth()+1, 0 );

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

//Berechnungswerte schreiben
schedule('0 0 * * *', function () {
    
    setState( pfad +'Erzeugung.Max_Gestern', getState( pfad +'Erzeugung.Max_Heute' ).val, true );  
    setState( pfad +'Umwelt._Berechnung.Baeume_Vortag', getState(pfad +'Umwelt.Baeume.Gesamt').val, true );
    setState( pfad +'Umwelt._Berechnung.CO2_Vortag', getState(pfad +'Umwelt.CO2.Gesamt').val, true );

    //Zähler zurücksetzen
    setState( pfad +'Erzeugung.Max_Heute', 0, true );

});

//Datenpunkte prüfen
function checkStates( state ){
    
    if( existsState( state ) === false ){

        createStates( pfad );
        return false;

    } else return true;

};

//Datenpunkte erstellen
function createStates( pfad ){

    let einheiten = ['Metrisch', 'Imperial'];

    createState( pfad +'Konfiguration.API-Key', 0, {read: true, write: true, type: 'string', desc: 'Solaredge API Schlüssel'});
    createState( pfad +'Konfiguration.SiteID', 0, {read: true, write: true, type: 'string', desc: 'Solaredge Anlagen ID'});
    createState( pfad +'Konfiguration.Einheit', 0, {read: true, write: true, type: 'number', desc: 'Metrische oder Imperiale Einheiten', states: einheiten});

    createState( pfad +'Erzeugung.Jetzt', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Aktuelle Leistung'});
    createState( pfad +'Erzeugung.Heute', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Heute erzeugte Energie'});
    createState( pfad +'Erzeugung.Monat', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Diesen Monat erzeugte Energie'});
    createState( pfad +'Erzeugung.Jahr', 0, {read: true, write: false, type: 'number', unit: 'kWh', desc: 'Dieses Jahr erzeugte Energie'});
        
    createState( pfad +'Erzeugung.Max_Heute', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Maximale Leistung Heute'});
    createState( pfad +'Erzeugung.Max_Gestern', 0, {read: true, write: false, type: 'number', unit: 'kW', desc: 'Maximale Leistung Gestern'});

    createState( pfad +'Umwelt.CO2.Gesamt', 0, {read: true, write: false, type: 'number', unit: 'kg', desc: 'Eingesparte CO2-Emissionen'});
    createState( pfad +'Umwelt.CO2.Heute', 0, {read: true, write: false, type: 'number', unit: 'kg', desc: 'Eingesparte CO2-Emissionen'});
    createState( pfad +'Umwelt.CO2.Monat', 0, {read: true, write: false, type: 'number', unit: 'kg', desc: 'Eingesparte CO2-Emissionen'});
    createState( pfad +'Umwelt.CO2.Jahr', 0, {read: true, write: false, type: 'number', unit: 'kg', desc: 'Eingesparte CO2-Emissionen'});

    createState( pfad +'Umwelt.Baeume.Gesamt', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});
    createState( pfad +'Umwelt.Baeume.Heute', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});
    createState( pfad +'Umwelt.Baeume.Monat', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});
    createState( pfad +'Umwelt.Baeume.Jahr', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Entspricht gepflanzten Bäumen'});

    createState( pfad +'Umwelt._Berechnung.Baeume_Vortag', 0, {read: true, write: false, type: 'number', unit: 'Stück', desc: 'Berechnungswert Bäume Gestern'});
    createState( pfad +'Umwelt._Berechnung.CO2_Vortag', 0, {read: true, write: false, type: 'number', unit: 'kg', desc: 'Berechnungswert CO2 Gestern'});
    
}
