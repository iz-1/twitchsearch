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

let imgw;// = 480;
let imgh;// = 272;
let searchStep = 0;

const ResponseFunction = {
    games: ParseGameListSearch
    ,clips: DisplayResultClips
    ,videos: DisplayResultClips
    ,streams: DisplayResultClips
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
        let targetObject = $(event.currentTarget);
        if(targetObject.hasClass('fa-play')) {
            targetObject = targetObject.parent(); // get div
            let parentDiv = targetObject.parent();
            targetObject.empty();

            switch(parentDiv.attr('type'))
            {
                case 'clips':
                    targetObject.append(GetEmbedStr(parentDiv.attr('src') + parentDiv.attr('vid')));
                break;
                case 'videos':
                    LoadTwitchPlayer(parentDiv.attr('vid'), targetObject.attr('id'));   
                break;
                case 'streams':
                    LoadTwitchPlayer(parentDiv.attr('uname'), targetObject.attr('id'), false);   
                break;
            }
        }
        else if(targetObject.hasClass('fa-link')) {            
            let jObj = $(event.currentTarget);
            CopyToClipboard(jObj);
        }
        else {
            // far
            let adding = targetObject.hasClass('far');
            let id = targetObject.attr('value');
            
            if(AddRemVideoIDtoFavorite(id, adding))
            {
                // fas fa-star
                targetObject.toggleClass('far');
                targetObject.toggleClass('fas');
            }
        }
    });

    $('#gamesBtn').on('click', function(event){
        event.preventDefault();
        ListGames();
    });

    $('#channelBtn').on('click', function(event){
        event.preventDefault();
        let nRes = 20;

        let searchVal = $('#search').val();
        if(searchVal == "")
            return;

        currSearch = 'channels';

        currSearchParams = GetParams(currSearch); 
        RequestRes(BuildQueryRequest(currSearch, currSearchParams, nRes), ResponseFunction[currSearch]); 
    });

    $('#addBtn').on('click', function(event){
        event.preventDefault();
        AddSearchItem();
    });

    $('#searchBtn').on('click', function(event){
        event.preventDefault();   
        SearchButton();
    });

    $('#checkbox-container').on('click', 'label', function(event){
        let targetLabel = $(event.currentTarget);
        if(targetLabel.hasClass('games') || targetLabel.hasClass('channels')) {
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

    RequestRes(BuildQueryRequest(currSearch, currSearchParams, nRes), ResponseFunction[currSearch]); ;
}

function SearchButton() {
    if($('input:checkbox').length == 0)
        return;

    ClearResults();

    currContent = $('input[name=content]:checked').val();

    $('section .results').addClass('hidden'); 
    currSearchParams = GetParams(currContent); 

    RequestRes(BuildQueryRequest(currContent, currSearchParams, 200), ResponseFunction[currContent]); 

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

    let numericalVal;
    let txt;

    if(years > 1) {numericalVal=years; txt='year';}
    else if(months > 1) {numericalVal=months; txt='month';}
    else if(days > 1) {numericalVal=days; txt='day';}
    else if(hrs > 1) {numericalVal=hrs; txt='hour';}
    else if(mins > 1) {numericalVal=mins; txt='min';}
    else if(secs > 1) {numericalVal=secs; txt='sec';}

    numericalVal = numericalVal.toFixed(0);

    return `${numericalVal} ${txt}${ numericalVal>1 ? 's' : '' }`;
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
            return true;
        }
        return false;
    } else {
        if(contained){
            UserFavorites[user][Fave[currContent]] = UserFavorites[user][Fave[currContent]].filter(e => {return e != id});
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

function AddSearchOption(text, value, type) {
    if($('input:checkbox').length > 0)
        $('#checkbox-container').empty();
    $('#checkbox-container').append(`<label class='${type}' style=''>${text} <i class="fas fa-times"></i></label><input type='checkbox' value='${value}' data-type='${type}' class='searchcriteria'>`);
}

function IsDuplicateOption(type, value){
    let chkboxarr = $('input:checkbox');
    for(let i=0; i<chkboxarr.length; ++i)
    {
        let checkbox = $(`input:checkbox:eq(${i})`);
        if(type == checkbox.attr('data-type') && value == checkbox.val())
            return true;        
    }
    return false;
}

function PopulateDummySearchList() {
    PopulateSelectOptions('#searchresult-list', [''], ['Search Results']);     
}

function ParseChannelSearch(response){
    BuildDropDownOptions(response.channels, 'display_name');
}

function ParseGameListSearch(response) {
    BuildDropDownOptions(response.games, 'name');
}

function BuildDropDownOptions(datalist, nameProperty) {
    let ids = [];
    let names = [];    
    datalist.forEach(function(e){
        ids.push(e._id);
        names.push(e[nameProperty]);        
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
            $('#searchBtn').prop('disabled', true);        
            $('#searchresult-list').prop('disabled', true);
            $('#sort-type').prop('disabled', true);
            $('#filter-date').prop('disabled', true);
            $('input[name=content]').prop('disabled', true);
        break;
        case 1:
            $('#addBtn').prop('disabled', false);
            $('#searchresult-list').prop('disabled', false);
        break;
        case 2:
            $('#searchBtn').prop('disabled', false);
            $('#sort-type').prop('disabled', false);
            $('#filter-date').prop('disabled', false); 
            $('input[name=content]').prop('disabled', false);
        break;
    }
}

function IndicateNextStep(bReset){
    let focuscolor = '#19171C';
    let unfocuscolor = '#fff';

    if(bReset) {
        searchStep = 1;
        $('.critera').css('background-color', unfocuscolor);
        $('.addterm').css('background-color', focuscolor);
        $('.game').css('background-color', focuscolor);
        $('.critera label').css('color', focuscolor); 
        $('.vl').css('border-color', focuscolor);
        $('#searchBtn').prop('disabled', true);
        $('#sort-type').prop('disabled', true);
        $('#filter-date').prop('disabled', true);        
        $('input[name=content]').prop('disabled', true);
        $('#addBtn p').text('Add'); //
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
            $('#addBtn p').text('Replace'); //
        break;
    }
}

function PopulateSelectOptions(id, valueList, textList = valueList) {
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

function ParseSearchCritera(){
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
    let nResults = 100; 

    let params = {
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
                //UserIdParams = {user_id: SearchCriteria.user_id[0]} 
                UserIdParams = {broadcaster_id: SearchCriteria.user_id[0]} 

            if(UserIdParams.hasOwnProperty('user_id') && GameIdParams.hasOwnProperty('game_id'))
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

    // replace token for mulitple games ids
    queryJoined = queryJoined.replace('!', '&game_id=');

    // replace token for mulitple user ids
    queryJoined = queryJoined.replace('.', '&user_id=');

    return url + `/${endpoint}` + '?' + queryJoined;
}

function RequestRes(req, fnt){
    fetch(req, {
        headers: {'Client-ID': clientID}
    })
    .then(response => {
        if(response.ok && response.status == 200)
            return response.json();
        throw new Error(response.statusText);
    })
    .then(responseJson => {
        if(responseJson.hasOwnProperty('data') && responseJson.data.length == 0)
            SetSearchResultsBanner(false);
        else
            fnt(responseJson);
    })
    .catch(err => {
        //console.log(err.message);
        console.log('error: ' + err.message);
    });
}

function SetSearchResultsBanner(bHasResults=true){
    $('section').removeClass('hidden');
    $('.resultheader').text(`${bHasResults ? 'Search': 'No'} Results`);
}

function ContentPropertyFind(id, property, token) {
    if(!currSearchParams.hasOwnProperty(property))
        return true;    

        let ids = currSearchParams[property].split(token);
        return ids.filter(e => {return e == id}).length > 0;
}

function ProperCase(str) {
    return str.replace(/\w\S*/g, function(t) { return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase(); });
}

function DisplayResultClips(response) { 
    let resultEntries = [];
    let searchContent = $('input[name=content]:checked').val();

    response.data.forEach(function(item, i){

        let name = item.hasOwnProperty('broadcaster_name') ? item.broadcaster_name : item.user_name;
        let url = (searchContent == 'streams') ? 'www.twitch.tv/' + name :  item.url;
        let favoritelink = isLoggedIn() ? `<i class='${ isContentFavorited(item.id) ? 'fas' : 'far'} fa-star' value='${item.id}'></i>` : '';

        let imgurl = item.thumbnail_url.replace('%{width}', '{width}').replace('%{height}', '{height}'); // todo regex/replace('%{') for all        
        imgurl = imgurl.replace('{width}', 480).replace('{height}', 272); // -- req for thumb

        const defaultImgUrl = 'https://vod-secure.twitch.tv/_404/404_processing_320x180.png';

        //clips:    no user_id
        //videos:   no broadcaster_id or game_id            
        let matchesUser = ContentPropertyFind( item.hasOwnProperty('user_id') ? item.user_id : item.broadcaster_id, 'user_id', '.');
        let matchesGame = item.hasOwnProperty('game_id') ? ContentPropertyFind(item.game_id, 'game_id', '!') : false;

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

        let srcUrl = (searchContent == 'clips') ? 'https://clips.twitch.tv/embed?clip=': '';

        if( (searchContent != 'videos' && matchesUser && matchesGame ) ||  // streams/clips
            matchesUser ) // videos
            {
                let divID = 'iteminfo' + resultEntries.length; // used for twitch player
                let aria = `${name}'s video`;

                resultEntries.push(
                    `<li vid='${item.id}' src='${srcUrl}' uname='${name}' type='${searchContent}' style="max-width:${imgw}px"><div aria-label="Embed Video" class='iteminfo' id=${divID} style="height:${imgh}px; width:${imgw}px; background-image: url('${imgurl}'), url('${defaultImgUrl}')">\                    
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
    SetSearchResultsBanner(true);
    $('section').removeClass('hidden');
}

function GetEmbedStr(src, bClip=false, w=imgw, h=imgh, bFullScreen=true, bScrolling=false, border=0){
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
    let login = $('#login').val();
    let password = $('#pass').val();

    if(login.length < minCredentialChars || password.length < minCredentialChars || !UserList.hasOwnProperty(login) || UserList[login] != password)
        return 'Invalid Login/Password';    
    user = login;
}

function isValidRegCredentials(){
    let login = $('#login').val();
    let password = $('#pass').val();

    if(login.length < minCredentialChars || password.length < minCredentialChars || UserList.hasOwnProperty(login))
        return `Invalid Registration - login/password must be atleast ${minCredentialChars} characters`;
    
    UserList[login] = password;
    UserFavorites[login] = [[], [], []];
    user = login;
}

function isLoggedIn(){
    return loginState == 'login';
}

function SetupLinkClickEvents() {
    $('#loginLink').on('click', function(){
        let result = isValidLoginCredentials();
        if(result == null)
            UpdateNavPanel('login');
        else
            OutputError(result);
    });

    $('#regLink').on('click', function(){
        let result = isValidRegCredentials();
        if(result == null)
            UpdateNavPanel('login');
        else
            OutputError(result);            
    });

    $('#logoutLink').on('click', function(){
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
    return `<li><p><i class='fas fa-star' value='${item}'></i> Clip <a href='https://clips.twitch.tv/${item}' target='_blank'>https://clips.twitch.tv/${item}</a></p></li>`;
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
}

function OutputError(err) {
    ShowModal(err);
}

function HideShowNavElementbyId(id, replaceStr=''){
    let element = $(`#${id}`);
    if(replaceStr == '') {
        element.text('');
        element.addClass('hidden');
    }else {
        element.text(replaceStr);
        element.removeClass('hidden');
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

$(startForm);