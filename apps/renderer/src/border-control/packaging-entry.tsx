import React from 'react'
import {Composition,registerRoot,getInputProps} from 'remotion'
import {Packaging,type PackagingProps} from './Packaging'
const Root=()=> <Composition id="BorderPackaging" component={Packaging} defaultProps={getInputProps() as PackagingProps} width={1080} height={1920} fps={30} durationInFrames={105} calculateMetadata={({props}:{props:PackagingProps})=>({width:props.width??1080,height:props.height??1920,durationInFrames:props.frames??(props.mode==='intro'?105:180)})}/>
registerRoot(Root)
