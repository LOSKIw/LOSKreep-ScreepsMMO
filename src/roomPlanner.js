let DT = require('distanceTransfer')

let buildingDict = {
    '0': '0',
    '1': STRUCTURE_STORAGE,
    '2': STRUCTURE_EXTENSION,
    '3': STRUCTURE_ROAD,
    '4': STRUCTURE_TOWER,
    '5': STRUCTURE_SPAWN,
    '6': STRUCTURE_LINK,
    '7': STRUCTURE_POWER_SPAWN,
    '8': STRUCTURE_NUKER,
    '9': STRUCTURE_TERMINAL,
    '10': STRUCTURE_FACTORY,
    '11': STRUCTURE_CONTAINER,
    '12': STRUCTURE_LAB,
    '13':STRUCTURE_RAMPART,
    '14':STRUCTURE_OBSERVER
}

let colorDic = {
    'road':'#ffffff',
    'rampart':'#00ff00'
}
/*
config存储配置，建筑块构造，数目，建造等级
每个建筑块:
    num:块数目【目前仅ext块有多个
    groupLoc:块内相对位置，数组，元素为数组，元素数组格式为[x,y]
    buidingType:对应groupLoc,建筑类型
    buidRcl:对应groupLoc，对应建造的rcl【ext无等级一说，内部为每个块对应的起建等级
*/
let groupName = ['coreGroup','extensionGroup','towerGroup','labGroup','nukerGroup','observerGroup']
let roomConfig = {
    coreGroup:{
        r:3,
        num:1,
        groupLoc:[[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1]],
        buildingType:[5,1,7,5,10,9,5,6],
        buildRcl:[1,4,8,7,7,6,8,6]
    },
    extensionGroup:{
        r:3,
        num:12,
        groupLoc:[[0,0],[1,0],[-1,0],[0,1],[0,-1]],
        buildingType:[2,2,2,2,2],
        buildRcl:[2,3,4,4,5,5,6,6,7,7,8,8]
    },
    towerGroup:{
        r:4,
        num:1,
        groupLoc:[[-1,1],[0,1],[1,0],[1,-1],[0,-1],[-1,0],[0,0]],
        buildingType:[4,4,4,4,4,4,11],
        buildRcl:[3,5,7,8,8,8,7]
    },
    labGroup:{
        r:5,
        num:1,
        groupLoc:[[0,-1],[1,-1],[1,0],[2,0],[2,1],[1,2],[0,2],[0,1],[-1,1],[-1,0],[0,0]],
        buildingType:[12,12,12,12,12,12,12,12,12,12,11],
        buildRcl:[6,6,6,7,7,7,8,8,8,8,8]
    },
    nukerGroup:{
        r:2,
        num:1,
        groupLoc:[[0,0]],
        buildingType:[8],
        buildRcl:[8]
    },
    observerGroup:{
        r:2,
        num:1,
        groupLoc:[[0,0]],
        buildingType:[14],
        buildRcl:[8]
    }
}

/*
PS:大量方法及思路均借鉴自曲奇大佬
【有些常用函数懒得写就直接抄曲奇大佬的了
*/
class roomPlan{
    /**
     * 
     * @param {String} roomName 
     */
    constructor(roomName){
        this.room = roomName;
    }
    getPlan(){
        let targetRoom = Game.rooms[this.room];
        let coreLoc
        let builtList = [];

        let layout = {
            spawn: [],
            extension: [],
            extractor: [],
            factory: [],
            lab: [],
            tower: [],
            link: [],
            nuker: [],
            observer: [],
            powerSpawn: [],
            storage: [],
            terminal: [],
            container: [],
            road: [],
            rampart:[]
        };
        
        let controller = targetRoom.controller;
        let controllerCostMap = initArr(0)
        this.getCostArray(controllerCostMap, controller.pos.x, controller.pos.y, 3);
        
        let sourceCostMap = initArr(0);
        let sources = targetRoom.find(FIND_SOURCES);
        for (let source of sources) {
            this.getCostArray(sourceCostMap, source.pos.x, source.pos.y, 2);
        }
        let mineralCostMap = initArr(0);
        let mineralL = targetRoom.find(FIND_MINERALS);
        if(mineralL.length > 0){
            let mineral = mineralL[0];
            this.getCostArray(mineralCostMap, mineral.pos.x, mineral.pos.y, 2);
            layout.extractor.push([mineral.pos.x,mineral.y,7]);
        }
        

        let tempMap = addArrays(sourceCostMap, multiplyArray(mineralCostMap, 0.25),
            controllerCostMap);
        
        let center = findMin(tempMap);
        
        //new RoomPosition(center[0],center[1],this.room).createFlag(this.room);
        let centerMap = initArr(0);
        this.getCostArray(centerMap,center[0],center[1],1)
        //块摆放
        for(let i in groupName){
            let tempCore = roomConfig[groupName[i]];
            for(let j = 0; j < tempCore.num; j++){
                
                let map = DT.getDistanceTransfer(this.room,builtList,1);
                let locList = getRLoc(tempCore.r,map);
                let node = getMinCostLocA(locList,centerMap)
                if(groupName[i] == 'coreGroup'){
                    builtList.push(node)
                }
                if(node != null){
                    putLayout(layout,builtList,node,groupName[i])
                }
                else{
                    console.log('error')
                    return
                }
            }
        }
        let boxNode = this.getBoundBox(builtList,true)
        
        let ramList = getRLoc(3,DT.getDistanceTransfer(this.room,builtList,3))
        for(let x = boxNode[0];x<=boxNode[1];x++){
            ramList.push([x,boxNode[3]])
            ramList.push([x,boxNode[2]])
        }
        for(let y = boxNode[2];y<=boxNode[3];y++){
            ramList.push([boxNode[0],y])
            ramList.push([boxNode[1],y])
        }
        //从内部排除多余点
        
        let RamList = this.floodfillRam(center,ramList)
        
        //获取出口点列表
        let start = []
        let terrain = new Room.Terrain(this.room);
        for(let x = 0;x<50;x++){
            if(terrain.get(x,0)!= TERRAIN_MASK_WALL){
                start.push([x,0])
            }
            if(terrain.get(x,49)!= TERRAIN_MASK_WALL){
                start.push([x,49])
            }
        }
        for(let y = 0;y<50;y++){
            if(terrain.get(0,y)!= TERRAIN_MASK_WALL){
                start.push([0,y])
            }
            if(terrain.get(49,y)!= TERRAIN_MASK_WALL){
                start.push([49,y])
            }
        }
        for(let node of start){
            RamList = this.floodfillRam(node,RamList)
        }
        //最终rampart
        layout['rampart'] = RamList

        layout['road'] = this.fillBuildingRoad(builtList,layout)

        builtList.push(layout['road'])
        let centerN = new RoomPosition(center[0],center[1],this.room)
        for(let source of sources){
            let path = centerN.findPathTo(source)
            for(let step of path){
                
                let loc = [step.x,step.y]

                if(!isOnWallOrEdge(...loc, terrain) && !isContained(builtList,loc) && !isContained(layout['road'],loc)){
                    layout['road'].push(loc)
                    builtList.push(loc)
                }
            }
        }
        return layout
    }
    fillBuildingRoad(buildingList,layout){
        let terrain = new Room.Terrain(this.room);
        let roadList = []
        for(let type in layout){
            if(type == 'tower' || type == 'lab' || type == 'road' || type == 'rampart' || type == 'nuker' || type == 'oboserver' || type == 'container'){
                continue
            }
            for(let node of layout[type]){
                let x = node[0]
                let y = node[1]
                let neighbors = [[x - 1, y],[x, y - 1], [x, y + 1], [x + 1, y]];
                for(let ro of neighbors){
                    if(!isOnWallOrEdge(...ro, terrain) && !isContained(buildingList,ro) && !isContained(roadList,ro)){
                        roadList.push(ro)
                    }
                }
            }
        }
        // for(let node of buildingList){
        //     let x = node[0]
        //     let y = node[1]
        //     let neighbors = [[x - 1, y],[x, y - 1], [x, y + 1], [x + 1, y]];
        //     for(let ro of neighbors){
        //         if(!isOnWallOrEdge(...ro, terrain) && !isContained(buildingList,ro) && !isContained(roadList,ro)){
        //             roadList.push(ro)
        //         }
        //     }
        // }
        return roadList
    }
    displayOther(final,type){
        let rv = new RoomVisual(this.room)
        for(let node of final){
            rv.circle(node[0],node[1],{radius:0.2,fill:colorDic[type]})
        }
    }
    floodfillRam(start,ramList){
        let terrain = new Room.Terrain(this.room);
        let finalRam = []
        let frontier = [start];
        let explored = initArr(false);
        while (frontier.length > 0) {
            let pos = frontier.shift();
            let x = pos[0];
            let y = pos[1];
            let neighbors = [[x - 1, y - 1], [x - 1, y], [x - 1, y + 1],
                [x, y - 1], [x, y + 1], [x + 1, y - 1], [x + 1, y], [x + 1, y + 1]];
            for (let p of neighbors) {
                if (!isOnWallOrEdge(...p, terrain) && !explored[p[0]][p[1]]) {
                    explored[p[0]][p[1]] = 1;
                    if(isContained(ramList,p)){
                        finalRam.push(p)
                    }
                    else{
                        frontier.push(p);
                    }
                }
            }
        }
        return finalRam
    }
    getBoundBox(builtList,show=false){
        let rv = new RoomVisual(this.room)
        let xmin=50,xmax=0
        let ymin=50,ymax=0
        for(let node of builtList){
            if(node[0]<xmin){
                xmin = node[0]
            }
            else if(node[0]>xmax){
                xmax = node[0]
            }
            if(node[1]<ymin){
                ymin = node[1]
            }
            else if(node[1]>ymax){
                ymax = node[1]
            }
        }
        xmax+=3
        xmin-=3
        ymax+=3
        ymin-=3
        if(show = true){
            for(let x = xmin;x<=xmax;x++){
                rv.rect(x-0.5,ymax-0.5,1,1,{fill: '#EEEE00'})
                rv.rect(x-0.5,ymin-0.5,1,1,{fill: '#EEEE00'})
            }
            for(let y = ymin;y<=ymax;y++){
                rv.rect(xmin-0.5,y-0.5,1,1,{fill: '#EEEE00'})
                rv.rect(xmax-0.5,y-0.5,1,1,{fill: '#EEEE00'})
            }
        }
        return [xmin,xmax,ymin,ymax]
    }
    displayArray(array){
        let rv = new RoomVisual(this.room)
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                rv.text(array[x][y],x,y)
            }
        }

    }
    disPlayLayout(layout){
        let rv = new RoomVisual(this.room)
        for(let temp in layout){
            if(temp!='road' && temp!='rampart'){
                for(let loc in layout[temp]){
                    rv.text(temp.substring(0,2)+layout[temp][loc][2],layout[temp][loc][0],layout[temp][loc][1],{color: 'white', font: 0.5})
                }
            }
            else{
                this.displayOther(layout[temp],temp)
            }
        }
    }
    getCostArray(array, x, y, infRange,type = 1) {
        let room = this.room;
        let initx = x, inity = y;
        let arr = this.bfs(x, y, type);
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                let dx = Math.abs(x - initx);
                let dy = Math.abs(y - inity);
                if ((dx+dy <= infRange) || arr[x][y] < 1) {
                    array[x][y] += Infinity;
                } else {
                    array[x][y] += arr[x][y] - infRange;
                }
            }
        }
    }
    bfs(initx, inity, type) {
        let terrain = new Room.Terrain(this.room);
        let arr = initArr(0);
        let frontier = [[initx, inity]];
        let explored = initArr(false);
        while (frontier.length > 0) {
            let pos = frontier.shift();
            let x = pos[0];
            let y = pos[1];
            let neighbors;
            if(type == 1){
                neighbors = [[x - 1, y],[x, y - 1], [x, y + 1], [x + 1, y]];
                let neighborsN = [[x - 1, y - 1], [x - 1, y + 1], [x + 1, y - 1], [x + 1, y + 1]];
                for (let p of neighbors) {
                    if (!isOnWallOrEdge(...p, terrain) && !explored[p[0]][p[1]]) {
                        arr[p[0]][p[1]] = arr[x][y] + 1;
                        frontier.push(p);
                        explored[p[0]][p[1]] = 1;
                    }
                }
                for (let p of neighborsN) {
                    if (!isOnWallOrEdge(...p, terrain) && !explored[p[0]][p[1]]) {
                        arr[p[0]][p[1]] = arr[x][y] + 2;
                        frontier.push(p);
                        explored[p[0]][p[1]] = 1;
                    }
                }
            }
            else if(type = 2){
                neighbors = [[x - 1, y - 1], [x - 1, y], [x - 1, y + 1],
                [x, y - 1], [x, y + 1], [x + 1, y - 1], [x + 1, y], [x + 1, y + 1]];
                for (let p of neighbors) {
                    if (!isOnWallOrEdge(...p, terrain) && !explored[p[0]][p[1]]) {
                        arr[p[0]][p[1]] = arr[x][y] + 1;
                        frontier.push(p);
                        explored[p[0]][p[1]] = 1;
                    }
                }
            }
            else if(type = 3){
                neighbors = [[x - 1, y - 1], [x - 1, y], [x - 1, y + 1],
                [x, y - 1], [x, y + 1], [x + 1, y - 1], [x + 1, y], [x + 1, y + 1]];
                for (let p of neighbors) {
                    if (!isOnWallOrEdge(...p, terrain) && !explored[p[0]][p[1]]) {
                        arr[p[0]][p[1]] = arr[x][y] + 1;
                        frontier.push(p);
                        explored[p[0]][p[1]] = 1;
                    }
                }
            }
        }
        return arr;
    }
    
}

module.exports = roomPlan;

/**
 * 
 * @param {Array} list 
 * @param {Array} map 
 */
function getMinCostLocA(list,map){
    let temp = 999999
    let pos = undefined
    for(let i in list){
        let cost = map[list[i][0]][list[i][1]]
        if(cost < temp){
            pos = list[i]
            temp = cost
        }
    }
    if(temp < 255){
        return pos
    }
    else{
        return null
    }
}

/**
 * 
 * @param {Array} list 
 * @param {CostMatrix} map 
 */
function getMinCostLocCM(list,map){
    let temp = 999999
    let pos = undefined
    for(let i in list){
        let cost = map.get(list[i][0],list[i][1])
        if(cost < temp){
            pos = list[i]
            temp = cost
        }
    }
    if(temp < 9999){
        return pos
    }
    else{
        return null
    }
}

/**
 * 
 * @param {number} r 
 * @param {CostMatrix} map 
 */
function getRLoc(r,map){
    let accLoc = []
    for (var y = 0; y < 50; ++y) {
        for (var x = 0; x < 50; ++x) {
            if(map.get(x,y)>=r){
                accLoc.push([x,y])
            }
        }
    }
    return accLoc
}

/**
 * 
 * @param {*} layout 
 * @param {Array} builtList 
 * @param {Array} pos 
 * @param {String} groupName 
 */
function putLayout(layout,builtList,pos,groupName){
    let plan = roomConfig[groupName]
    for(let i in plan.groupLoc){
        if(groupName == 'extensionGroup'){
            layout[buildingDict[plan.buildingType[i]]].push([pos[0]+plan.groupLoc[i][0],pos[1]+plan.groupLoc[i][1],roomConfig['extensionGroup']['buildRcl'][Math.floor((layout['extension'].length)/5)]])
        }
        else{
            layout[buildingDict[plan.buildingType[i]]].push([pos[0]+plan.groupLoc[i][0],pos[1]+plan.groupLoc[i][1],plan.buildRcl[i]])
        }
        builtList.push([pos[0]+plan.groupLoc[i][0],pos[1]+plan.groupLoc[i][1]])
    }
}
function initArr(content) {
    let arr = new Array(50);
    for (let i = 0; i < 50; i++) {
        arr[i] = new Array(50).fill(content);
    }
    return arr;
}

function isOnWallOrEdge(x, y, rt) {
    if (x <= 0 || x >= 49 || y <= 0 || y >= 49) {
        return true;
    }
    return rt.get(x, y) === TERRAIN_MASK_WALL;
}

function addArrays(...arrays) {
    let result = initArr(0);
    for (let array of arrays) {
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                result[x][y] += array[x][y];
            }
        }
    }
    return result;
}

function multiplyArray(array, constant) {
    let result = initArr(0);
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            result[x][y] += array[x][y] * constant;
        }
    }
    return result;
}

function findMin(matrix) {
    let minValue = Infinity;
    let minX = -1;
    let minY = -1;
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            if (matrix[x][y] < minValue) {
                minX = x;
                minY = y;
                minValue = matrix[x][y];
            }
        }
    }
    return [minX, minY];
}
/**
 * 
 * @param {Array} a
 * @param {Array} b 
 */
function isContained(a, b){
    let bstr = b.toString()
    for(let i = 0; i< a.length; i+=1){
        if(a[i].length<b.length){continue}
        let tempStr = a[i].toString();
        if(tempStr == bstr){return true}
    }
    return false;
}

function CisContained(a, b){
    let bstr = b.toString()
    let count = 0
    for(let i = 0; i< a.length; i+=1){
        if(a[i].length<b.length){continue}
        let tempStr = a[i].toString();
        if(tempStr == bstr){count += 1}
    }
    console.log('inside',count)
    return count;
}