import React from 'react'
import {Composition,registerRoot,getInputProps} from 'remotion'
import {Narrative,type NarrativeProps} from './Narrative'
const Root=()=> <Composition id="Narrative" component={Narrative} defaultProps={getInputProps() as NarrativeProps} width={1080} height={1920} fps={30} durationInFrames={875} calculateMetadata={({props}:{props:NarrativeProps})=>({durationInFrames:props.frames})}/>
registerRoot(Root)
