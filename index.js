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
let prevRequest;
//let cursor = '';

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
    PopulateDropdowns();
    SetupLinkClickEvents();

    $('.modalcontent').on('click', function(){
        $('.modal').css('display', 'none');
    });
    
    $('#result-list').on('click', 'i', function(event){        
        //console.log('clicked ' + $(event.currentTarget));
        if($(event.currentTarget).hasClass('fa-link')) {            
            let jObj = $(event.currentTarget);
            CopyToClipboard(jObj);
        }
        else {
            // far
            let adding = $(event.currentTarget).hasClass('far');
            let id = $(event.currentTarget).attr('value');
            
            console.log($(event.currentTarget));

            if(AddRemVideoIDtoFavorite(id, adding))
            {
                // fas fa-star
                $(event.currentTarget).toggleClass('far');
                $(event.currentTarget).toggleClass('fas');
            }
        }
    });

    $('#SearchBtn').on('click', function(){
        let nRes = 20;

        let searchVal = $('#search').val();
        if(searchVal == "")
            return;

        //currSearch = $('#content-type :selected').val();
        currSearch = 'games';

        const params = GetParams(currSearch); 
       Request(BuildQueryRequest(currSearch, params, nRes), ResponseFunction[currSearch]); 
    });

    $('#ChannelBtn').on('click', function(){
        let nRes = 20;

        let searchVal = $('#search').val();
        if(searchVal == "")
            return;

        //currSearch = $('#content-type :selected').val();
        currSearch = 'channels';

        const params = GetParams(currSearch); 
       Request(BuildQueryRequest(currSearch, params, nRes), ResponseFunction[currSearch]); 
    });

    $('#addBtn').on('click', function(){
        if($('#checkbox-container input').length < MAX_ids && $('#searchresult-list :selected').val() != null)
            AddSearchOption(
                $('#searchresult-list :selected').text(), 
                $('#searchresult-list :selected').val(),
                currSearch,
            );
    });

    $('#FindBtn').on('click', function(){
        ClearResults();
        //FindContentChange();

        currContent = $('#find-type :selected').val();
        //console.log(currContent);
        $('section .results').addClass('hidden'); 
        const params = GetParams(currContent); 
        prevRequest = BuildQueryRequest(currContent, params, 200);

        if(!params.hasOwnProperty('game_id') && 
            !params.hasOwnProperty('user_id') )
            return;

        //cursor = '';
        Request(prevRequest, ResponseFunction[currContent]); 

        /* todo, find all
        let tmpCursor = '';
        if(cursor != '')
        {
            prevRequest = Object.assign(prevRequest, {after: cursor});
            Request(prevRequest, ResponseFunction[currContent]); 
            tmpCursor = cursor;
        }
        */
    });

    $('form').on('change', '[type=checkbox]', function(event){
        $(event.currentTarget).prev('label').remove();
        event.currentTarget.remove();
    });

    $('form').on('change', '#filter-date', function(event){
        let currDate = new Date();

        $('.date').each(function(i, obj){
            let diffDate = (currDate - new Date($(obj).attr('value'))) / (1000 * 60 * 60 * 24);
            let hideDiff = 9999;

            switch($('#filter-date :selected').val())
            {
                case 'day': hideDiff = 1;
                break;
                case 'week': hideDiff = 7;              
                break;
                case 'month': hideDiff = 30;
                break;     
            }

            if(diffDate >= hideDiff)
                $(obj).closest('li').addClass('hidden');
            else
                $(obj).closest('li').removeClass('hidden');
        });

    });

    /*
    $('#find-type').on('change', function(){        
        FindContentChange();
    });
    */
}

// handled in GetParams - store these criteria for filtering data after retrival
/*
function FindContentChange(){
    switch($('#find-type :selected').val()){
        case 'clips': RemoveCriteraForClipSearch(); break; // api: clips only allows 1 id {game or broadcaster}
        case 'videos': break; 
        case 'streams': break;
    }
} */

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

function ShowModal(text){
    $('.modalcontent p').text(text);
    $('.modal').css('display', 'block');
}

function PopulateDropdowns() {
    BuildNumResultsOptions();
    PopulateSelectOptions('#find-type', 'clips,videos,streams'.split(','));
    PopulateSelectOptions('#content-type', 'games,channels'.split(','));
    //Request('https://api.twitch.tv/helix/games/top', StoreTopGames); // find top games
    PopulateSelectOptions('#filter-date', 'all,day,week,month'.split(','));
    PopulateSelectOptions('#sort-type', 'time,trending,views'.split(','));
}

function AddSearchOption(text, val, type) {
    $('#checkbox-container').append(`<label class='${type}'>${text}</label><input type='checkbox' value='${val}' data-type='${type}' class='searchcriteria'>`);
}

function ParseChannelSearch(response){
    console.log(response);
    let names = [];
    let ids = [];
    response.channels.forEach(function(e){
        names.push(e.display_name);
        ids.push(e._id);
    });
    PopulateSelectOptions('#searchresult-list', ids, names);    
}

function ParseGameListSearch(response){
    //console.log(response);
    let names = [];
    let ids = [];
    response.games.forEach(function(e){
        names.push(e.name);
        ids.push(e._id);
    });
    PopulateSelectOptions('#searchresult-list', ids, names);
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

/*
function StoreTopGames(response) {
    //console.log(response);

    response.data.forEach(function(e) {
        gameList[e.name] = e.id;
    });
    //PopulateSelectOptions('#game-list', Object.keys(gameList).sort());
}
*/

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
                UserIdParams = {};
       
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

    console.log(queryJoined);

    return url + `/${endpoint}` + '?' + queryJoined;
}

function Request(req, fnt){
    console.log(req);

    fetch(req, {
        headers: {'Client-ID': clientID}
    })
    .then(response => {
        if(response.ok)
            return response.json();
        throw new Error(response.statusText);
    })
    .then(responseJson => fnt(responseJson))
    .catch(err => {
        console.log(response);
        console.log(responseJson);
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

function DisplayResultClips(response){
    console.log(response);

    let resultEntries = [];
    //let playerName = "SamplePlayerDivID";
    //let table = {};

    let searchContent = $('#find-type :selected').val();

    //let cursor = "";

    console.log(JSON.stringify(currSearchParams));

    response.data.forEach(function(item, i){

        let name = item.hasOwnProperty('broadcaster_name') ? item.broadcaster_name : item.user_name;
        let url = (searchContent == 'streams') ? 'www.twitch.tv/' + name :  item.url;
        let favoritelink = isLoggedIn() ? `<i class='${ isContentFavorited(item.id) ? 'fas' : 'far'} fa-star' value='${item.id}'></i>` : '';
        
        const imgw = 480;
        const imgh = 272;

        let imgurl = item.thumbnail_url.replace('%{width}', '{width}').replace('%{height}', '{height}'); // todo regex/replace('%{') for all
        imgurl = imgurl.replace('{width}', imgw).replace('{height}', imgh);

        if(imgurl == '')   
            imgurl = 'https://vod-secure.twitch.tv/_404/404_processing_320x180.png'; // default blank img

        //clips:    no user_id
        //videos:   no broadcaster_id or game_id            
        let matchesUser = ContentMatchesUser( item.hasOwnProperty('user_id') ? item.user_id : item.broadcaster_id);
        let matchesGame = item.hasOwnProperty('game_id') ? ContentMatchesGame(item.game_id) : false;

        // streams has no view_count/created_at
        let viewsProp = item.hasOwnProperty('view_count') ? 'view_count' : 'viewer_count';
        let viewTitle = ProperCase(viewsProp.replace('_', ' '));
        let dateProp = item.hasOwnProperty('created_at') ? 'created_at' : 'started_at';
        let dateTitle = ProperCase(dateProp.replace('_', ' '));

        if( (searchContent != 'videos' && matchesUser && matchesGame ) ||  // streams/clips
            matchesUser ) // videos
            {
                resultEntries.push(
                    `<li><img src='${imgurl}'>\
                    <div class='resultitem'><p class='title'>${name} - ${item.title}</p><br>\
                    <p>${favoritelink}<i class='fas fa-link'></i><a href='${url}' target='_blank'>${url}</a></p><br>\                        
                    <p class='views' value='${item[viewsProp]}'>${viewTitle}: ${item[viewsProp]}</p><br>\
                    <p class='date' value='${item[dateProp]}'>${dateTitle}: ${item[dateProp]}</p></div></li>`);
            }

    });
    $('#result-list').append(resultEntries.join(''));

    //cursor = response.pagination.cursor;

    /*
    new Twitch.Player('SamplePlayerDivID0', {
        width: 400
        ,height: 300
        ,video: 'CaringSpineyTrianglePupper' // 356983236 
        ,autoplay: false
        ,allowfullscreen: true
        ,preload: 'none'
    });
    */

    $('section').removeClass('hidden');    
}

function isValidLoginCredentials(){
    //console.log($('#login').length + " " + $('#pass').length);
    let l = $('#login').val();
    let p = $('#pass').val();

    if(l.length < minCredentialChars || p.length < minCredentialChars || !UserList.hasOwnProperty(l) || UserList[l] != p)
        return 'Invalid Login/Password';    
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