'use strict';

const SearchUrl = 'https://api.twitch.tv/';
const DefaultEndpoint = 'helix';
const GameEndpoint = 'kraken/search';

const maxResults = 100;
const defaultMinResults = 10;
const clientID = '8yu0vcvvsjluvob2ekbeym4ij5ztns';

const MAX_ids = 100;

let gameList = {};
let currSearch = '';
let currContent = '';
let currSearchParams = {};

let prevSearchParams;

let imgw;// = 480;
let imgh;// = 272;
let searchStep = 0;

const ResponseFunction = {
    games: ParseGameListSearch
    ,clips: DisplayResultClips
    ,videos: DisplayResultClips
    ,streams: DisplayResultClips // DisplayResultStreams
    ,channels: ParseChannelSearch
};

const UserList = {admin:'admin'};
const Fave = {clips:0, videos:1, streams:2};
const UserFavorites = {
    admin: [[], [], []] // clips-video-streams
};
const LoginStates = ['logout', 'login'];
const minCredentialChars = 5;

let loginState = 'logout';
let user = '';

function startForm(){
    searchStep = 0;
    $(window).resize(function(){InitItemDims()});
    DisableEnableUI();
    InitItemDims();
    PopulateDropdowns();
    SetupLinkClickEvents();

    $('.modalcontent').on('click', function(){
        $('.modal').css('display', 'none');
    });
    
    $('#result-list').on('click', 'i', 'div', function(event){        
        let t = $(event.currentTarget);
        if(t.hasClass('fa-play')) {
            t = t.parent(); // get div
            let p = t.parent();
            t.empty();


            switch(p.attr('type'))
            {
                case 'clips':
                    t.append(GetEmbedStr(p.attr('src') + p.attr('vid')));
                break;
                case 'videos':
                    LoadTwitchPlayer(p.attr('vid'), t.attr('id'));   
                break;
                case 'streams':
                    LoadTwitchPlayer(p.attr('uname'), t.attr('id'), false);   
                break;
            }

            console.log('check src:' + p.attr('src') == null);
        }
        else if(t.hasClass('fa-link')) {            
            let jObj = $(event.currentTarget);
            CopyToClipboard(jObj);
        }
        else {
            // far
            let adding = t.hasClass('far');
            let id = t.attr('value');
            
            if(AddRemVideoIDtoFavorite(id, adding))
            {
                // fas fa-star
                t.toggleClass('far');
                t.toggleClass('fas');
            }
        }
    });

    $('#GamesBtn').on('click', function(event){
        event.preventDefault();
        ListGames();
    });

    $('#ChannelBtn').on('click', function(event){
        event.preventDefault();
        let nRes = 20;

        let searchVal = $('#search').val();
        if(searchVal == "")
            return;

        currSearch = 'channels';

        currSearchParams = GetParams(currSearch); 
        RequestRes(BuildQueryRequest(currSearch, currSearchParams, nRes), currSearchParams, ResponseFunction[currSearch]); 
    });

    $('#addBtn').on('click', function(event){
        event.preventDefault();
        AddSearchItem();
    });

    $('#SearchBtn').on('click', function(event){
        event.preventDefault();   
        SearchButton();
    });

    $('#checkbox-container').on('click', 'label', function(event){
        let t = $(event.currentTarget);
        if(t.hasClass('games') || t.hasClass('channels')) {
            $(event.currentTarget).next('input').remove();
            event.currentTarget.remove();

            // if 0 checkboxes
            if( $('.games').length == 0 && $('.channels').length == 0)
                IndicateNextStep(true);
        }
    });

    $('form').on('change', '#filter-date', function(event){
        let currDate = new Date();

        $('.date').each(function(i, obj){
            let diffDate = (currDate - new Date($(obj).attr('value'))) / (1000 * 60 * 60 * 24);
            let hideRangeHigh = 9999;
            let hideRangeLow = 0;

            switch($('#filter-date :selected').val())
            {
                case 'day': 
                    hideRangeHigh = 1;
                    hideRangeLow = 0;
                break;
                case 'week': 
                    hideRangeHigh = 7;              
                    hideRangeLow = 1;
                break;
                case 'month': 
                    hideRangeHigh = 30.4167;
                    hideRangeLow = 7;
                break;     
                case 'year': 
                    hideRangeHigh = 365;
                    hideRangeLow = 30.4167;
                break;
            }

            if(diffDate >= hideRangeHigh || diffDate < hideRangeLow)
                $(obj).closest('li').addClass('hidden');
            else
                $(obj).closest('li').removeClass('hidden');
        });

    });

    $('body').on('keyup', function(event){
        if(event.keyCode == 13) // enter
        switch(searchStep)
        {
            case 0:
                ListGames();
            break;
            case 1:
                AddSearchItem();
            break;
            case 2:
                SearchButton();
            break;
        }
    });

    $('.content-list').on('change', 'input', function(event){
            $('.content-list input').each(function(){
                let t = $(this);
                t.prop('checked') ? t.parent().addClass('clist-active') : t.parent().removeClass('clist-active');
            });
            SearchButton();
    });

    $('#sort-type').on('change', function(){        
        SearchButton();
    });
}

function AddSearchItem(){
    if($('#checkbox-container input').length < MAX_ids && $('#searchresult-list :selected').val() != null) {
        AddSearchOption(
            $('#searchresult-list :selected').text(), 
            $('#searchresult-list :selected').val(),
            currSearch,
        );
        IndicateNextStep();
        DisableEnableUI();
    }
}

function ListGames() {
    let searchVal = $('#search').val();
    if(searchVal == "")
        return;

    let nRes = 20;

    currSearch = 'games';

    currSearchParams = GetParams(currSearch);

    RequestRes(BuildQueryRequest(currSearch, currSearchParams, nRes), currSearchParams, ResponseFunction[currSearch]); ;
}

function SearchButton() {
    if($('input:checkbox').length == 0)
        return;

    ClearResults();

    currContent = $('input[name=content]:checked').val();

    $('section .results').addClass('hidden'); 
    currSearchParams = GetParams(currContent); 

    RequestRes(BuildQueryRequest(currContent, currSearchParams, 200), currSearchParams, ResponseFunction[currContent]); 

    $('#filter-date').val('all');    
}

function GetDaysStr(dat){
    //(new Date() - new Date(val)) / (1000 * 60 * 60 * 24).toFixed(0);
    let diffms = new Date() - new Date(dat);
    let secs = diffms / 1000;
    let mins = secs / 60;
    let hrs = mins / 60;
    let days = hrs / 24;
    let months = days / 30.4167;
    let years = months / 12;

    let val;
    let txt;

    if(years > 1) {val=years; txt='year';}
    else if(months > 1) {val=months; txt='month';}
    else if(days > 1) {val=days; txt='day';}
    else if(hrs > 1) {val=hrs; txt='hour';}
    else if(mins > 1) {val=mins; txt='min';}
    else if(secs > 1) {val=secs; txt='sec';}

    val = val.toFixed(0);

    return `${val} ${txt}${val>1?'s':''}`;
}

function CopyToClipboard(jObj) {
    console.log(jObj); // @todo
    /*
    let link = $(event.currentTarget).find('a');
    console.log(link);
    //console.log(domObj.attr('href')); 
    domObj.focus();
    domObj.setSelectionRange(0, jObj.val().length);
    document.execCommand('copy');
    */    
}

function isContentFavorited(id, type=currContent) {
    return UserFavorites[user][Fave[type]].includes(id);
}

function AddRemVideoIDtoFavorite(id, addToList=true) {   
    if(!isLoggedIn())
        return false;
    let contained = UserFavorites[user][Fave[currContent]].includes(id);
    if(addToList) {
        if(!contained) {
            UserFavorites[user][Fave[currContent]].push(id);
            console.log(`Add ${user}: ${currContent}: ${id}`);
            console.log(UserFavorites);
            return true;
        }
        return false;
    } else {
        if(contained){
            UserFavorites[user][Fave[currContent]] = UserFavorites[user][Fave[currContent]].filter(e => {return e != id});
            console.log(`Rem ${user}: ${currContent}: ${id}`);
            console.log(UserFavorites);
            return true;            
        }
        return false;
    }
}

function InitItemDims(){
    let docw = $('body').width();    
    imgw = 480;
    if(imgw > docw)
        imgw = docw;
    imgh = imgw * (272 / 480); 
}

function ShowModal(text){
    $('.modalcontent p').text(text);
    $('.modal').css('display', 'block');
}

function PopulateDropdowns() {
    BuildNumResultsOptions();
    PopulateSelectOptions('#content-type', 'games,channels'.split(','));
    PopulateSelectOptions('#filter-date', 'all,day,week,month,year'.split(','));
    PopulateSelectOptions('#sort-type', 'time,trending,views'.split(','));
    PopulateDummySearchList();
}

function AddSearchOption(text, val, type) {
    if($('input:checkbox').length == 0)
        $('#checkbox-container').append(`<label class='${type}' style=''>${text} <i class="fas fa-times"></i></label><input type='checkbox' value='${val}' data-type='${type}' class='searchcriteria'>`);
}

function IsDuplicateOption(type, val){
    let chkboxarr = $('input:checkbox');
    for(let i=0; i<chkboxarr.length; ++i)
    {
        let o = $(`input:checkbox:eq(${i})`);
        let t = o.attr('data-type');
        let v = o.val();        
        if((type == t) && (val == v))
            return true;        
    }
    return false;
}

function PopulateDummySearchList() {
    PopulateSelectOptions('#searchresult-list', [''], ['Search Results']);     
}

function ParseChannelSearch(response, params){
    //console.log(response);
    let names = [];
    let ids = [];
    response.channels.forEach(function(e){
        names.push(e.display_name);
        ids.push(e._id);
    });
    PopulateSelectOptions('#searchresult-list', ids, names); 
    if(searchStep == 0) {
        IndicateNextStep();
        DisableEnableUI();
    }
}

function ParseGameListSearch(response, params) {
    //console.log(response);
    let names = [];
    let ids = [];
    response.games.forEach(function(e){
        names.push(e.name);
        ids.push(e._id);
    });
    PopulateSelectOptions('#searchresult-list', ids, names);
    if(searchStep == 0) {
        IndicateNextStep();
        DisableEnableUI();
    }
}

function DisableEnableUI(){
    switch(searchStep){
        case 0:
            $('#addBtn').prop('disabled', true);   
            $('#SearchBtn').prop('disabled', true);        
            $('#searchresult-list').prop('disabled', true);
            $('#sort-type').prop('disabled', true);
            $('#filter-date').prop('disabled', true);
            //$('.navitem').prop('disabled', true);
            $('input[name=content]').prop('disabled', true);
        break;
        case 1:
            $('#addBtn').prop('disabled', false);
            $('#searchresult-list').prop('disabled', false);
        break;
        case 2:
            $('#SearchBtn').prop('disabled', false);
            $('#sort-type').prop('disabled', false);
            $('#filter-date').prop('disabled', false); 
            //$('.navitem').prop('disabled', false);  
            $('input[name=content]').prop('disabled', false);
        break;
    }
}

function IndicateNextStep(bReset){
    let focuscolor = '#19171C';
    let unfocuscolor = '#fff';//'#444';

    if(bReset) {
        searchStep = 1;
        $('.critera').css('background-color', unfocuscolor);
        $('.addterm').css('background-color', focuscolor);
        $('.game').css('background-color', focuscolor);
        $('.critera label').css('color', focuscolor); 
        $('.vl').css('border-color', focuscolor);
        $('#SearchBtn').prop('disabled', true);
        $('#sort-type').prop('disabled', true);
        $('#filter-date').prop('disabled', true);        
        //$('.navitem').prop('disabled', true);
        $('input[name=content]').prop('disabled', true);
        return;
    }

    switch(++searchStep)
    {
        case 1:
            $('.addterm').css('background-color', focuscolor);
            $('.addterm').css('transition', '200ms');
            $('.game').css('background-color', unfocuscolor);
        break;
        case 2:
            $('.critera').css('background-color', focuscolor);
            $('.critera').css('transition', '200ms');
            $('.addterm').css('background-color', unfocuscolor);
            $('.game').css('background-color', unfocuscolor);
            $('.critera label').css('color', unfocuscolor);
            $('.vl').css('border-color', unfocuscolor);
            $('.games').css('color', 'blue');
            $('.channels').css('color', 'red');
        break;
    }
    
}

function PopulateSelectOptions(id, valueList, textList = valueList) {
    //console.log(valueList);
    $(id).empty();
    $(id).append(valueList.map( (e,i) => {
        return `<option value='${e}'>${textList[i]}</option>`;
    }).join(''));
    $(id).val(valueList[0]);
}

function BuildNumResultsOptions() {    
    let strArray = [];
    for(let i=20; i<=maxResults; i+=5)
        strArray.push(i);
    
    PopulateSelectOptions('#number-results', strArray);
}

// for clip searches we want results by games then we will filter the results
function RemoveCriteraForClipSearch(){
    let bFirst = false;
    $('input:checkbox').each(function(){
        let isGame = $(this).attr('data-type') == 'games';
        if(!bFirst && isGame)
            bFirst = true;
        else if(isGame)
        {
            $(this).prev('label').remove();
            $(this).remove();
        }
    });
}

function ParseSearchCritera(){
    //console.log('ParseSearchCritera');
    let result = {game_id: new Set(), user_id: new Set()};
    
    $('input:checkbox').each(function(){
        let type = $(this).attr('data-type');
        let val = $(this).val();
        switch(type){
            case 'games':
                result.game_id.add(val);
            break;
            case 'channels':
                result.user_id.add(val);
            break;            
        }
        
    });
    return {game_id: Array.from(result.game_id), user_id: Array.from(result.user_id)};
}

function GetParams(selectedType){
    let nResults = 100; // $('#number-results :selected').val(); todo

    let params = {
        //game_id: gameid,
        first: nResults
        //,after: ''
    };

    let params2;

    /*------------------------------------------------------------------------------------------------------
    * "Multiple IDs or Logins can not be comma separated (id=1,2), repeat the parameter instead (id=1&id=2)"
    *------------------------------------------------------------------------------------------------------*/

    let SearchCriteria = ParseSearchCritera();
    let UserIdParams = {};
    let GameIdParams = {};

    if(SearchCriteria.game_id.length > 0)
        GameIdParams = {game_id: SearchCriteria.game_id.join('!')}    // &game_id=
        
    if(SearchCriteria.user_id.length > 0)
        UserIdParams = {user_id: SearchCriteria.user_id.join('.')}  // &user_id=           
            
    currSearchParams = Object.assign({}, params, params2, UserIdParams, GameIdParams); // store extra critera for filtering results
    let searchVal = $('#search').val();

    switch(selectedType) {
        case 'clips':  // only1 id allowed      
            if(SearchCriteria.game_id.length > 0)
                GameIdParams = {game_id: SearchCriteria.game_id[0]}

            if(SearchCriteria.user_id.length > 0)
                UserIdParams = {user_id: SearchCriteria.user_id[0]} 

            if(UserIdParams.hasOwnProperty('user_id') && GameIdParams.hasOwnProperty('game_id'))
                //UserIdParams = {};
                GameIdParams = {};
       
        break;
        case 'videos': // 1 game_id or user_id
            params2 = { 
                    language: 'en' //         
                    ,period: $('#filter-date :selected').val() //'all' "day", "week", "month"
                    ,sort: $('#sort-type :selected').val() // 'time' trending", "views
                    ,type: "all" // "upload", "archive", "highlight"
                }

            if(SearchCriteria.game_id.length > 0)
                GameIdParams = {game_id: SearchCriteria.game_id[0]}

            if(SearchCriteria.user_id.length > 0)
                UserIdParams = {user_id: SearchCriteria.user_id[0]}   

            if(UserIdParams.hasOwnProperty('user_id') && GameIdParams.hasOwnProperty('game_id'))
                GameIdParams = {};   
        break;
        case 'streams': 
            params2 = {        
                language: 'en' // 
            }      
        break; 
        case 'games':
        case 'channels':
            return { 
                query: searchVal //
                ,type: 'suggest'
                //,limit: 100
            }        
        break;                               
    }

    return Object.assign({}, params, params2, UserIdParams, GameIdParams);
}

function BuildQueryRequest(endpoint, params, maxResults=defaultMinResults){
    let queryStr = Object.keys(params)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);

    let url = SearchUrl;
    
    if(endpoint == 'games' || endpoint == 'channels')
        url += GameEndpoint;
    else
        url += DefaultEndpoint;

    let queryJoined = queryStr.join('&');

    console.log(queryJoined);

    // replace token for mulitple games ids
    queryJoined = queryJoined.replace('!', '&game_id=');

    // replace token for mulitple user ids
    queryJoined = queryJoined.replace('.', '&user_id=');

    //console.log(queryJoined);

    return url + `/${endpoint}` + '?' + queryJoined;
}

async function RequestRes(req, param, fnt){
    console.log(req);
    //prevRequest = req;

    fetch(req, {
        headers: {'Client-ID': clientID}
    })
    .then(response => {
        if(response.ok)
            return response.json();
        throw new Error(response.statusText);
    })
    .then(responseJson => {
        return responseJson;
    })
    .then(responseJson => fnt(responseJson, param))
    .catch(err => {
        //console.log(response);
        //console.log(responseJson);
        console.log(err.message);
    })
}

function ContentMatchesUser(broadCasterID){
    //console.log(JSON.stringify(currSearchParams) + " " + broadCasterID);

    if(!currSearchParams.hasOwnProperty('user_id'))
        return true;

    let ids = currSearchParams.user_id.split('.');
    return ids.filter(e => {return e == broadCasterID}).length > 0;
}

function ContentMatchesGame(gameID){
    //console.log(JSON.stringify(currSearchParams) + " " + gameID);

    if(!currSearchParams.hasOwnProperty('game_id'))
        return true;

    let ids = currSearchParams.game_id.split('!');
    return ids.filter(e => {return e == gameID}).length > 0;
}

function ProperCase(str) {
    return str.replace(/\w\S*/g, function(t) { return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase(); });
}

function DisplayResultClips(response, params) { // used params
    console.log(response);

    let resultEntries = [];
    //let playerName = "SamplePlayerDivID";
    //let table = {};

    //let searchContent = $('#find-type :selected').val();
    let searchContent = $('input[name=content]:checked').val();

    //console.log(JSON.stringify(currSearchParams));

    response.data.forEach(function(item, i){

        let name = item.hasOwnProperty('broadcaster_name') ? item.broadcaster_name : item.user_name;
        let url = (searchContent == 'streams') ? 'www.twitch.tv/' + name :  item.url;
        let favoritelink = isLoggedIn() ? `<i class='${ isContentFavorited(item.id) ? 'fas' : 'far'} fa-star' value='${item.id}'></i>` : '';
        
        let imgurl = item.thumbnail_url.replace('%{width}', '{width}').replace('%{height}', '{height}'); // todo regex/replace('%{') for all
        //imgurl = imgurl.replace('{width}', imgw).replace('{height}', imgh);
        
        imgurl = imgurl.replace('{width}', 480).replace('{height}', 272); // -- req for thumb

        if(imgurl == '')   
            imgurl = 'https://vod-secure.twitch.tv/_404/404_processing_320x180.png'; // default blank img

        //clips:    no user_id
        //videos:   no broadcaster_id or game_id            
        let matchesUser = ContentMatchesUser( item.hasOwnProperty('user_id') ? item.user_id : item.broadcaster_id);
        let matchesGame = item.hasOwnProperty('game_id') ? ContentMatchesGame(item.game_id) : false;

        // streams has no view_count/created_at
        let viewsProp = 'view_count';
        let viewTitle = 'views';

        if(item.hasOwnProperty('viewer_count'))
        {
            viewsProp = 'viewer_count';
            viewTitle = 'viewers';
        }

        let dateProp = item.hasOwnProperty('created_at') ? 'created_at' : 'started_at';
        let dateTitle = ProperCase(dateProp.replace('_', ' '));

        //console.log('mode: ' + searchContent);
        let srcUrl = (searchContent == 'clips') ? 'https://clips.twitch.tv/embed?clip=': '';//'https://player.twitch.tv/?video=';

        if( (searchContent != 'videos' && matchesUser && matchesGame ) ||  // streams/clips
            matchesUser ) // videos
            {
                let divID = 'iteminfo' + resultEntries.length; // used for twitch player
                let aria = `${name}'s video`;

                resultEntries.push(
                    `<li vid='${item.id}' src='${srcUrl}' uname='${name}' type='${searchContent}' style="max-width:${imgw}px"><div aria-label="Embed Video" class='iteminfo' id=${divID} style="height:${imgh}px; width:${imgw}px; background-image: url('${imgurl}')">\                    
                    <p class='views' value='${item[viewsProp]}'>${item[viewsProp]} ${viewTitle}</p>\
                    <i class="fas fa-play fa-3x"></i>\
                    <p class='date' value='${item[dateProp]}'>${GetDaysStr(item[dateProp])}</p>\
                    </div>\                    
                    <div class='resultitem'>\                    
                    <p class='title'><a href='${url}' target='_blank' alt='${aria}' aria-label='${aria}'>${item.title}</a></p><br>\
                    <p>${favoritelink}<i class='fas fa-link'></i></p><p class='username'>${name}</p><br>\
                    </div></li>`);
            }
    });
    $('#result-list').append(resultEntries.join(''));
    $('section').removeClass('hidden');
}

function GetEmbedStr(src, bClip=false, w=imgw, h=imgh, bFullScreen=true, bScrolling=false, border=0){
    console.log('called GetEmbedStr');
    return `<iframe
    src="${src}&autoplay=false"
    height="${h}"
    width="${w}"
    frameborder="${border}"
    scrolling="${bScrolling}"
    allowfullscreen="${bFullScreen}">
    </iframe>`;
}

function LoadTwitchPlayer(srcID, divId, bIsVideo=true) {
    console.log('called LoadTwitchPlayer, is video?' + bIsVideo);
    let embed;

    if(bIsVideo) {
        embed = new Twitch.Embed(divId, {
            width: imgw,
            height: imgh,
            layout: "video",
            autoplay: true,
            muted: false,
            video: srcID        
        });
    }
    else {
        embed = new Twitch.Embed(divId, {
            width: imgw,
            height: imgh,
            layout: "video",
            autoplay: true,
            muted: false,
            channel: srcID        
        });
    }

    embed.addEventListener(Twitch.Embed.VIDEO_READY, () => {
        let player = embed.getPlayer();
        player.play();
    });
}

function isValidLoginCredentials(){
    //console.log($('#login').length + " " + $('#pass').length);
    let l = $('#login').val();
    let p = $('#pass').val();

    if(l.length < minCredentialChars || p.length < minCredentialChars || !UserList.hasOwnProperty(l) || UserList[l] != p)
        return 'Invalid Login/Password ×';    
    user = l;
}

function isValidRegCredentials(){
    let l = $('#login').val();
    let p = $('#pass').val();

    if(l.length < minCredentialChars || p.length < minCredentialChars || UserList.hasOwnProperty(l))
        return 'Invalid Registration - login/password must be atleast ${minCredentialChars} characters';
    
    UserList[l] = p;
    UserFavorites[l] = [[], [], []];
    user = l;
}

function isLoggedIn(){
    return loginState == 'login';
}

function SetupLinkClickEvents() {
    $('#loginLink').on('click', function(){
        let res = isValidLoginCredentials();
        if(res == null)
            UpdateNavPanel('login');
        else
            OutputError(res);
    });

    $('#regLink').on('click', function(){
        let res = isValidRegCredentials();
        if(res == null)
            UpdateNavPanel('login');
        else
            OutputError(res);            
    });

    $('#logoutLink').on('click', function(){
        console.log(loginState);
        if(loginState == 'login')
            UpdateNavPanel('logout');
    });    

    $('#deleteLink').on('click', function(){
        RemoveUser(user);
        if(loginState == 'login')
            UpdateNavPanel('logout');
    });    

    $('#faveLink').on('click', function(){
        ShowFavorites();
    });
}

function FavoriteItemString(item) {
    return `<li><p value='${item}'></p><p><i class='fas fa-star'></i> Clip <a href='https://clips.twitch.tv/${item}' target='_blank'>https://clips.twitch.tv/${item}</a></p></li>`;
}

function ShowFavorites(){
    ClearResults();
    let list = [];

    UserFavorites[user][Fave.clips].forEach(function(item){
        list.push(FavoriteItemString(item));
    });
    UserFavorites[user][Fave.videos].forEach(function(item){
        list.push(FavoriteItemString(item));
    });
    UserFavorites[user][Fave.streams].forEach(function(item){
        list.push(FavoriteItemString(item));
    });    

    $('#result-list').append(list.join(''));
}

function RemoveUser(id) {
    delete UserList[id];
    delete UserFavorites[id];
    console.log(UserList);
    console.log(UserFavorites);
}

function OutputError(err) {
    console.log(err);
    ShowModal(err);
}

function HideShowNavElementbyId(id, replaceStr=''){
    let e = $(`#${id}`);
    if(replaceStr == '') {
        e.text('');
        e.addClass('hidden');
    }else {
        e.text(replaceStr);
        e.removeClass('hidden');
    }
}

function UpdateNavPanel(state){
    switch(state){
        case 'login': 
            HideShowNavElementbyId('loginLink');
            HideShowNavElementbyId('regLink');

            HideShowNavElementbyId('logoutLink', 'Logout');
            HideShowNavElementbyId('faveLink', 'Favorites');
            HideShowNavElementbyId('deleteLink', 'Delete Account');

            HideShowNavElementbyId('login');
            HideShowNavElementbyId('pass');

        break;
        case 'logout': 
            HideShowNavElementbyId('logoutLink');
            HideShowNavElementbyId('faveLink');
            HideShowNavElementbyId('deleteLink');

            HideShowNavElementbyId('loginLink', 'Login');
            HideShowNavElementbyId('regLink', 'Register');

            HideShowNavElementbyId('login', ' ');
            HideShowNavElementbyId('pass', ' ');        

            user = '';
            ClearResults();
        break;
    }
    loginState = state;
    $('#login').val('');
    $('#pass').val('');    
}

function ClearResults() {
    $('#result-list').empty();
}

function DisplayResult(response){
    console.log(response); 
}

$(startForm);