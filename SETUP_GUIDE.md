# ぐるポ 営業ポータル（Firebase版・第1段階土台）セットアップ手順

## 1. Firebase プロジェクトの作成
1. [Firebase Console](https://console.firebase.google.com/) を開き、「プロジェクトを追加」をクリックします。
2. 左メニュー「構築」→「Authentication」→「始める」を押し、以下の2つを有効にします。
   - **メール / パスワード**（有効にする）
   - **Google**（有効にする・サポートメールを選択）
3. 左メニュー「構築」→「Firestore Database」→「データベースの作成」を押し、本番モード（またはテスト後に `firestore.rules` を反映）で作成します。
4. Firestore の「ルール」タブに同梱の `firestore.rules` の内容を貼り付けて「公開」します。

## 2. Webアプリ設定値の取得
1. Firebase Console 左上の歯車アイコン →「プロジェクトの設定」を開きます。
2. 下部の「マイアプリ」から `</>`（Web）アイコンをクリックしてアプリを登録します。
3. 表示される `firebaseConfig` の6つの値をメモします（`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`）。

## 3. Vercel（またはローカル）での起動・公開
1. このフォルダを GitHub へアップロードするか、PCで `npm install` → `npm run build` を実行します。
2. Vercel にインポートし、Environment Variables（環境変数）に `.env.example` の6項目を設定して「Deploy」します。
3. **重要**: デプロイ後に発行されたURL（例: `your-app.vercel.app`）を、Firebase Console の「Authentication」→「設定」→「承認済みドメイン」に追加してください（これを追加するとGoogleログインが動きます）。

## 4. 最初の管理者登録
1. 公開したURLにアクセスし、最初にGoogleログインまたはメール新規登録を行ったユーザーは自動的に **管理者（admin）** として承認されます。
2. 2人目以降の営業メンバーには、「メニュー」→「管理者向け機能」から招待コード（または招待URL）を発行して共有してください。
