import React from 'react'
import {Composition,registerRoot,getInputProps} from 'remotion'
import {EditorialLong,type LongProps} from './EditorialLong'
registerRoot(()=> <Composition id="EditorialLong" component={EditorialLong} defaultProps={getInputProps() as LongProps} width={1920} height={1080} fps={30} durationInFrames={9702} calculateMetadata={({props}:{props:LongProps})=>({durationInFrames:props.frames})}/>)
