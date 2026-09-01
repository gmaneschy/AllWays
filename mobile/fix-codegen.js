const fs = require('fs');
const path = require('path');

// Lista de arquivos afetados (cole o caminho completo do projeto do usuário)
const files = [
  'node_modules/react-native/src/private/specs_DEPRECATED/components/ActivityIndicatorViewNativeComponent.js',
  'node_modules/react-native/src/private/specs_DEPRECATED/components/DebuggingOverlayNativeComponent.js',
  'node_modules/react-native/src/private/specs_DEPRECATED/components/ProgressBarAndroidNativeComponent.js',
  'node_modules/react-native/src/private/specs_DEPRECATED/components/PullToRefreshViewNativeComponent.js',
  'node_modules/react-native/src/private/specs_DEPRECATED/components/RCTInputAccessoryViewNativeComponent.js',
  'node_modules/react-native/src/private/specs_DEPRECATED/components/RCTModalHostViewNativeComponent.js',
  'node_modules/react-native/src/private/specs_DEPRECATED/components/RCTSafeAreaViewNativeComponent.js',
  'node_modules/react-native/src/private/specs_DEPRECATED/components/UnimplementedNativeViewNativeComponent.js',
  'node_modules/react-native/src/private/components/virtualview/VirtualViewNativeComponent.js',
  'node_modules/react-native/src/private/components/virtualview/VirtualViewExperimentalNativeComponent.js',
];

for (const relPath of files) {
  const filePath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`[pulado] não encontrado: ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1) Abre parêntese logo após "export default " quando seguido de codegenNativeComponent
  content = content.replace(
    /export default codegenNativeComponent/,
    'export default (codegenNativeComponent'
  );

  // 2) Troca "  ) as HostComponent<...>;" (fim do cast) por "): HostComponent<...>);"
  content = content.replace(
    /\)\s+as\s+(HostComponent<[^;]+>);/,
    '): $1);'
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[corrigido] ${relPath}`);
  } else {
    console.log(`[sem alteração / já corrigido] ${relPath}`);
  }
}

console.log('\nPronto. Agora rode: npx patch-package react-native');
