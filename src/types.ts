export type world = {
    id: string,
    name?: string,
    description?: string,
    created_at?: string,
    chapters: Chapter[],
    events: Event[],
    connections: Connection[],
    timelines: Timeline[],
    papers: paper[]
    storyLines: StoryLine[]
    groupConnections: GroupConnection[],
    subway_settings: Subway_Settings
}

export type info<t> ={
    message: string,
    status: string,
    data: t
}
export interface ExtendedChapter extends Chapter {
    papperName: string,
    timelineName: string,
    storylineName: string,
    papperOrder: number
    // eventName:string
  }

export type basicWorld = {
    id: string,
    name?: string,
    created_at?: string,
    description?: string
}


export type paper = {
    id: string,
    name: string,
    description: string,
    Path: string,
    created_at: string,
    world_id: string,
    chapter?: Chapter[],
    order: number,
    focus: boolean,
    color: string
}

export type ChapterDetails = {
	chapter: Chapter,
	timeline:Timeline,
	storyLine: StoryLine,
    documentUrl:string,
    events: Event[],
    color: string,
    next: Chapter,
    prev: Chapter,
    relatedChapters: relatedChapter[]
}
export type chapterBasicInfo= {
    id: string;
    name: string;
}

export type description = {
    id: string,
    resource_type: string,
    resource_id?: string,
    description_data?: string
    name?: string
}
export type relatedChapter =  {
    "chapterID": string, 
    "relatedChapter": chapterBasicInfo,
    "groupName": string,
    "groupColor": string
}

export type GroupConnection = {
  focus: any
	id            :string, 
	name          :string, 
	description   :string, 
	world_id      :string, 
	color         :string,
}


export type Chapter = {
    width?: number | 0
    height?: number| 0
    id: string,
    world_id: string,
    title: string,
    description: string,
    created_at: string,
    group?: string
    paper_id: string,
    event_Id: string,
    timeline_id: string,
    storyline_id: string,
    range: number,
    order: number,
    color: string,
    selected?: boolean,
    focus?: boolean,
    last_update?: any
}

export type ChapterTimeline =  {
	id  :       string      ,  
	chapter_Id :string     ,   
	timelineID :string,
	range    :  number  ,          
}


export type Connection = {
    id: string,
    sourceChapterID: string,
    targetChapterID: string,
    world_id: string,
    color:string,
    group_id:string | null,
    focus?: boolean

}
export type Subway_Settings = {
    id: string,
    chapter_names: boolean,
    display_table_chapters: boolean,
    timeline_update_chapter: boolean,
    storyline_update_chapter: boolean,
    zoom: number,
    x: number,
    y: number,
    world_id: string,
    group_connection_update_chapter: boolean
}


export type Event = {
    id: string,
    name: string,
    description: string,
    world_id: string,
    range: number,
    startRange: number
}





export type Timeline = {
    id: string,
    world_id: string,
    name: string,
    description: string,
    order: number,
    range: number,
    created_at?: string,
    edit?: boolean


}


export type StoryLine = {
    id: string,
    world_id: string,
    name: string,
    description: string,
    created_at: string,
    order: number,
    height?: number
}





