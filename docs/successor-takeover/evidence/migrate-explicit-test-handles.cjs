const fs=require('node:fs');const path=require('node:path');const ts=require(path.join(process.cwd(),'node_modules/typescript'));
const files=process.argv.slice(2);
for(const file of files){
 const input=fs.readFileSync(file,'utf8'),source=ts.createSourceFile(file,input,ts.ScriptTarget.Latest,true);const edits=[];let seq=0;
 const claimCall=node=>ts.isAwaitExpression(node)&&ts.isCallExpression(node.expression)&&ts.isPropertyAccessExpression(node.expression.expression)&&node.expression.expression.name.text==='claim'?node.expression:null;
 const key=call=>call.expression.expression.getText(source)+'|'+call.arguments[0]?.getText(source);
 function visit(node,env){
  if(ts.isBlock(node)||ts.isSourceFile(node)){
   const local=new Map(env);
   for(const statement of node.statements){
    if(ts.isExpressionStatement(statement)){
     const call=claimCall(statement.expression);
     if(call){const name='claimAuthority'+(++seq);edits.push({start:statement.getStart(source),end:statement.getEnd(),text:'const '+name+' = '+statement.expression.getText(source)+';'});local.set(key(call),name);continue;}
    }
    if(ts.isVariableStatement(statement))for(const decl of statement.declarationList.declarations){if(decl.initializer&&ts.isIdentifier(decl.name)){const call=claimCall(decl.initializer);if(call)local.set(key(call),decl.name.text);}}
    visit(statement,local);
   }return;
  }
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
   const method=node.expression.name.text,handle=env.get(key(node));
   if(handle&&method==='submitForReview'&&node.arguments.length===1)edits.push({start:node.getEnd()-1,end:node.getEnd()-1,text:', '+handle+'.attempt_authority'});
   if(handle&&method==='complete'&&node.arguments.length>=1&&node.arguments.length<8)edits.push({start:node.getEnd()-1,end:node.getEnd()-1,text:', undefined'.repeat(7-node.arguments.length)+', '+handle+'.attempt_authority'});
  }
  ts.forEachChild(node,child=>visit(child,env));
 }
 visit(source,new Map());let output=input;for(const e of edits.sort((a,b)=>b.start-a.start))output=output.slice(0,e.start)+e.text+output.slice(e.end);fs.writeFileSync(file,output);console.log(file+': '+edits.length+' explicit-handle edits');
}
