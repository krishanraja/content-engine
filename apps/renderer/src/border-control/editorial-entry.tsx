import retiredStyles from '../../../../config/retired-styles.json'
import React from 'react'
import {Composition,registerRoot,getInputProps} from 'remotion'
import {EditorialShort} from './Editorial'
import type {ShortProps} from './Short'
const Root=()=> <Composition id="EditorialShort" component={EditorialShort} defaultProps={getInputProps() as ShortProps} width={1080} height={1920} fps={30} durationInFrames={2262} calculateMetadata={({props}:{props:ShortProps})=>({durationInFrames:props.frames})}/>
if (!retiredStyles.some(row => row.kind === 'composition' && row.id === 'EditorialShort')) registerRoot(Root)
