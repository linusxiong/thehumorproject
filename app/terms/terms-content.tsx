"use client";

import { Card, Chip, Link, Separator, Typography } from "@heroui/react";
import { dailyExplanationLimit, dailyJokeLimit } from "@/lib/jokes";
import { htmlLang, localizedBrandName, useLocale, type Messages } from "../locale";

const datasetUrl = "https://huggingface.co/datasets/qiushibaike-bak/metadata";
const datasetId = "qiushibaike-bak/metadata";
const issuesUrl = "https://github.com/linusxiong/thehumorproject/issues";
const updated = new Date("2026-10-14T00:00:00Z");

type Section = { id: string; title: string; paragraphs: string[] };

const en = {
  badge: "Terms of Service",
  title: "The fine print, kept short",
  intro: `By using ${localizedBrandName.en} you agree to these terms. If you do not agree, please do not use the service.`,
  updated: "Last updated",
  sourcesTitle: "Imported jokes and where they come from",
  sourcesLead: "Some jokes in the feed are labeled Qiushibaike. They come from a public archive of posts from Qiushibaike (糗事百科), a Chinese humor community that has since closed:",
  datasetLabel: "Dataset",
  datasetFiles: "Files: articles.bson.gz and articles.json.gz, published on Hugging Face in December 2022.",
  sources: [
    "We selected among the most-liked text-only posts in the archive, kept only posts that read as jokes or funny anecdotes, removed topic hashtags and emoticon codes, and adapted them into English, Spanish, and Chinese versions.",
    "Each imported joke is credited to the username its author used on Qiushibaike and carries a Qiushibaike label. These authors are not members of this site and did not submit their posts here.",
    "The date shown on an imported joke is when it was added to this site; it is not the original posting date. Ratings on this site come from our readers only and are unrelated to likes on Qiushibaike.",
    "The archive does not state a license. Copyright in each post stays with its original author. We are not affiliated with Qiushibaike or with the maintainers of the archive.",
    "If you wrote one of these posts and want it removed or credited differently, contact us (see Contact) and we will act promptly.",
  ],
  contactTitle: "Contact",
  contactLead: "Questions, takedown requests, or reports of content that breaks these terms:",
  contactLink: "open an issue on the project repository",
  sections: [
    { id: "service", title: "What the service does", paragraphs: [
      `${localizedBrandName.en} lets members share a joke in English, Spanish, or Chinese. We automatically produce versions for English-, Spanish-, and Chinese-speaking audiences that try to keep the original meaning and punchline, and readers rate whether each version is still funny.`,
      "Reading is open to everyone. Sharing and rating require signing in with a Google account that has a verified email address.",
    ] },
    { id: "content", title: "Your jokes", paragraphs: [
      "You keep ownership of what you share. By sharing a joke, you give us a worldwide, non-exclusive, royalty-free license to store, display, translate, adapt, and distribute it and its versions as part of the service.",
      "Only share jokes you wrote or have the right to share. Adult humor, including sexual jokes and innuendo, is allowed; we label it 18+. Do not share hateful or harassing content, any sexual content involving minors, unlawful content, or personal information about others. We may decline, edit labels on, or remove any content.",
      `Each account can share up to ${dailyJokeLimit} jokes in 24 hours.`,
    ] },
    { id: "adaptations", title: "Automatic adaptations", paragraphs: [
      "Versions, translations, punchline summaries, and notes are generated automatically. They can be inaccurate, miss a joke, or read differently from the original. They are not reviewed by the original author and should not be taken as the author's own words.",
    ] },
    { id: "explanations", title: "Community explanations", paragraphs: [
      "Any signed-in member can explain what a joke really means, for example a hidden pun, homophone, or innuendo the versions missed. The same content rules apply.",
      "Explanations are public and shown as added by a community member (or, for your own joke, as the author's explanation), never with your name. When we accept an explanation, all versions of that joke are regenerated from it and their ratings are reset. We may reject explanations that do not fit the joke.",
      `By submitting an explanation you give us the same license as for the jokes you share. Each account can submit up to ${dailyExplanationLimit} explanations in 24 hours.`,
    ] },
    { id: "ratings", title: "Ratings", paragraphs: [
      "Each account has one rating per version, which it can change or withdraw. Totals stay hidden until you have rated a version of that joke so they cannot bias your vote. Do not manipulate ratings with multiple accounts or automation.",
    ] },
    { id: "privacy", title: "Privacy", paragraphs: [
      "We use your Google name and profile photo to show your account, and store a one-way digest of your verified email to keep one rating per version. Jokes you share are public and credited with your first name. We do not sell personal data.",
    ] },
    { id: "liability", title: "Disclaimers and changes", paragraphs: [
      "The service is provided as is, without warranties. To the extent the law allows, we are not liable for indirect or consequential damages arising from its use. We may update these terms; the date above shows the latest version, and continued use means you accept the changes.",
    ] },
  ] as Section[],
};

const messages: Messages<typeof en> = {
  en,
  es: {
    badge: "Términos del servicio",
    title: "La letra pequeña, en corto",
    intro: `Al usar ${localizedBrandName.es} aceptas estos términos. Si no estás de acuerdo, no uses el servicio.`,
    updated: "Última actualización",
    sourcesTitle: "Chistes importados y su origen",
    sourcesLead: "Algunos chistes del feed llevan la etiqueta Qiushibaike. Proceden de un archivo público de publicaciones de Qiushibaike (糗事百科), una comunidad china de humor que ya cerró:",
    datasetLabel: "Conjunto de datos",
    datasetFiles: "Archivos: articles.bson.gz y articles.json.gz, publicados en Hugging Face en diciembre de 2022.",
    sources: [
      "Elegimos entre las publicaciones de solo texto con más «me gusta» del archivo, conservamos solo las que funcionan como chistes o anécdotas graciosas, quitamos los hashtags de tema y los códigos de emoticonos, y las adaptamos a versiones en inglés, español y chino.",
      "Cada chiste importado se atribuye al nombre de usuario que su autor usaba en Qiushibaike y lleva la etiqueta Qiushibaike. Esos autores no son miembros de este sitio ni publicaron aquí sus textos.",
      "La fecha que aparece en un chiste importado es la de su incorporación a este sitio, no la fecha original de publicación. Las calificaciones de este sitio provienen solo de nuestros lectores y no tienen relación con los «me gusta» de Qiushibaike.",
      "El archivo no indica ninguna licencia. Los derechos de autor de cada publicación siguen perteneciendo a su autor original. No tenemos relación con Qiushibaike ni con quienes mantienen el archivo.",
      "Si escribiste una de estas publicaciones y quieres que la retiremos o que cambiemos la atribución, contáctanos (ver Contacto) y lo haremos cuanto antes.",
    ],
    contactTitle: "Contacto",
    contactLead: "Preguntas, solicitudes de retirada o avisos de contenido que incumpla estos términos:",
    contactLink: "abre un issue en el repositorio del proyecto",
    sections: [
      { id: "service", title: "Qué hace el servicio", paragraphs: [
        `${localizedBrandName.es} permite a sus miembros compartir un chiste en inglés, español o chino. Generamos automáticamente versiones para públicos angloparlantes, hispanohablantes y chinos que intentan conservar el sentido y el remate originales, y los lectores califican si cada versión sigue siendo graciosa.`,
        "Cualquiera puede leer. Para compartir y calificar hay que iniciar sesión con una cuenta de Google con correo verificado.",
      ] },
      { id: "content", title: "Tus chistes", paragraphs: [
        "Lo que compartes sigue siendo tuyo. Al compartir un chiste nos concedes una licencia mundial, no exclusiva y gratuita para almacenarlo, mostrarlo, traducirlo, adaptarlo y distribuirlo, junto con sus versiones, como parte del servicio.",
        "Comparte solo chistes que hayas escrito o que tengas derecho a compartir. Se permite el humor para adultos, incluidos los chistes sexuales y los dobles sentidos; lo marcamos como 18+. No publiques contenido de odio o acoso, ningún contenido sexual que involucre a menores, contenido ilegal ni datos personales de otras personas. Podemos rechazar, reetiquetar o retirar cualquier contenido.",
        `Cada cuenta puede compartir hasta ${dailyJokeLimit} chistes cada 24 horas.`,
      ] },
      { id: "adaptations", title: "Adaptaciones automáticas", paragraphs: [
        "Las versiones, traducciones, resúmenes del remate y notas se generan automáticamente. Pueden ser inexactos, perder el chiste o sonar distinto del original. El autor original no los revisa y no deben tomarse como palabras suyas.",
      ] },
      { id: "explanations", title: "Explicaciones de la comunidad", paragraphs: [
        "Cualquier miembro con sesión iniciada puede explicar qué significa realmente un chiste, por ejemplo un juego de palabras oculto, un homófono o un doble sentido que las versiones no captaron. Se aplican las mismas normas de contenido.",
        "Las explicaciones son públicas y se muestran como aporte de un miembro de la comunidad (o, en tu propio chiste, como explicación del autor), nunca con tu nombre. Cuando aceptamos una explicación, todas las versiones de ese chiste se regeneran a partir de ella y sus votos se reinician. Podemos rechazar explicaciones que no encajen con el chiste.",
        `Al enviar una explicación nos concedes la misma licencia que para los chistes que compartes. Cada cuenta puede enviar hasta ${dailyExplanationLimit} explicaciones cada 24 horas.`,
      ] },
      { id: "ratings", title: "Calificaciones", paragraphs: [
        "Cada cuenta tiene una calificación por versión, que puede cambiar o retirar. Los totales permanecen ocultos hasta que calificas una versión de ese chiste, para que no influyan en tu voto. No manipules las calificaciones con varias cuentas ni de forma automatizada.",
      ] },
      { id: "privacy", title: "Privacidad", paragraphs: [
        "Usamos tu nombre y foto de Google para mostrar tu cuenta, y guardamos un resumen irreversible de tu correo verificado para mantener una calificación por versión. Los chistes que compartes son públicos y se firman con tu nombre de pila. No vendemos datos personales.",
      ] },
      { id: "liability", title: "Exenciones y cambios", paragraphs: [
        "El servicio se ofrece tal cual, sin garantías. En la medida en que la ley lo permita, no respondemos de daños indirectos o consecuentes derivados de su uso. Podemos actualizar estos términos; la fecha de arriba indica la versión vigente y seguir usando el servicio implica aceptar los cambios.",
      ] },
    ],
  },
  zh: {
    badge: "服务条款",
    title: "细则，尽量简短",
    intro: `使用${localizedBrandName.zh}即表示你同意以下条款。如不同意，请不要使用本服务。`,
    updated: "最后更新",
    sourcesTitle: "导入的笑话及其来源",
    sourcesLead: "信息流中部分笑话带有“糗事百科”标签。它们来自糗事百科（一个现已关闭的中文幽默社区）帖子的公开存档：",
    datasetLabel: "数据集",
    datasetFiles: "文件：articles.bson.gz 与 articles.json.gz，于 2022 年 12 月发布在 Hugging Face 上。",
    sources: [
      "我们从存档中点赞最多的纯文字帖子里挑选，只保留读起来像笑话或趣事的内容，去掉话题标签和表情代码，并改编成英文、西班牙文和中文版本。",
      "每条导入的笑话都署作者在糗事百科使用的用户名，并带有“糗事百科”标签。这些作者不是本站成员，也没有在本站发布这些内容。",
      "导入笑话上显示的日期是它被加入本站的时间，并非原始发布时间。本站的评分只来自本站读者，与糗事百科上的点赞数无关。",
      "该存档没有声明许可协议。每条帖子的著作权仍归原作者所有。我们与糗事百科及存档维护者均无关联。",
      "如果你是其中某条帖子的作者，希望删除或更改署名，请联系我们（见“联系我们”），我们会尽快处理。",
    ],
    contactTitle: "联系我们",
    contactLead: "如有疑问、删除请求，或发现违反本条款的内容：",
    contactLink: "在项目仓库提交 issue",
    sections: [
      { id: "service", title: "服务内容", paragraphs: [
        `${localizedBrandName.zh}让成员用英文、西班牙文或中文分享笑话。我们会自动为英语、西班牙语和中文读者生成尽量保留原意和笑点的版本，再由读者评价每个版本是否依旧好笑。`,
        "所有人都可以阅读。分享和评分需要使用邮箱已验证的 Google 账号登录。",
      ] },
      { id: "content", title: "你的笑话", paragraphs: [
        "你分享的内容仍归你所有。分享笑话即表示你授予我们全球范围、非独占、免版税的许可，以便在本服务中存储、展示、翻译、改编和传播该笑话及其各个版本。",
        "请只分享你自己创作或有权分享的笑话。允许成人幽默（包括带性暗示的笑话和荤段子），我们会将其标记为 18+。不要发布仇恨或骚扰内容、任何涉及未成年人的性内容、违法内容，也不要发布他人的个人信息。我们可以拒绝、调整标签或删除任何内容。",
        `每个账号 24 小时内最多可分享 ${dailyJokeLimit} 条笑话。`,
      ] },
      { id: "adaptations", title: "自动改编", paragraphs: [
        "各版本、译文、核心笑点和改编说明均为自动生成，可能不准确、丢失笑点，或读起来与原文不同。它们未经原作者审阅，不应被视为原作者本人的表述。",
      ] },
      { id: "explanations", title: "社区笑点说明", paragraphs: [
        "任何已登录的成员都可以说明一个笑话的真正含义，例如各版本没有理解的隐藏双关、谐音或暗示。同样适用上述内容规则。",
        "笑点说明是公开的，会显示为“社区用户补充”（在你自己分享的笑话上显示为“作者说明”），不会显示你的名字。说明一经采用，该笑话的所有版本都会据此重新生成，其评分也会被清零。与笑话不符的说明可能会被拒绝。",
        `提交说明即表示你授予我们与分享笑话相同的许可。每个账号 24 小时内最多可提交 ${dailyExplanationLimit} 条说明。`,
      ] },
      { id: "ratings", title: "评分", paragraphs: [
        "每个账号对每个版本只有一次评分，可以修改或撤回。在你给该笑话的某个版本评分之前，统计结果会保持隐藏，以免影响你的判断。请勿使用多个账号或自动化手段操纵评分。",
      ] },
      { id: "privacy", title: "隐私", paragraphs: [
        "我们使用你的 Google 名字和头像来显示你的账号，并保存已验证邮箱的不可逆摘要，以保证每个版本只评一次分。你分享的笑话是公开的，并以你的名字署名。我们不会出售个人数据。",
      ] },
      { id: "liability", title: "免责声明与条款变更", paragraphs: [
        "本服务按现状提供，不作任何保证。在法律允许的范围内，我们不对因使用本服务产生的间接或后果性损失承担责任。我们可能更新本条款；上方日期为当前版本，继续使用即表示你接受变更。",
      ] },
    ],
  },
};

export function TermsContent() {
  const locale = useLocale();
  const t = messages[locale];
  const date = new Intl.DateTimeFormat(htmlLang[locale], { dateStyle: "long", timeZone: "UTC" }).format(updated);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <Chip color="accent" variant="soft" className="w-fit">{t.badge}</Chip>
        <Typography.Heading level={1}>{t.title}</Typography.Heading>
        <Typography.Paragraph color="muted">{t.intro}</Typography.Paragraph>
        <Typography.Paragraph size="sm" color="muted">{t.updated}: <time dateTime={updated.toISOString().slice(0, 10)}>{date}</time></Typography.Paragraph>
      </section>

      {t.sections.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="flex flex-col gap-3">
          <Typography.Heading id={`${section.id}-title`} level={3}>{section.title}</Typography.Heading>
          {section.paragraphs.map((paragraph) => <Typography.Paragraph key={paragraph}>{paragraph}</Typography.Paragraph>)}
        </section>
      ))}

      <Card id="sources" aria-labelledby="sources-title">
        <Card.Header>
          <Card.Title id="sources-title">{t.sourcesTitle}</Card.Title>
          <Card.Description>{t.sourcesLead}</Card.Description>
        </Card.Header>
        <Card.Content className="gap-4">
          <div className="flex flex-col gap-1">
            <Typography.Paragraph size="sm" weight="semibold">{t.datasetLabel}</Typography.Paragraph>
            <Link href={datasetUrl} target="_blank" rel="noopener noreferrer" className="w-fit">
              <Typography.Code>{datasetId}</Typography.Code>
            </Link>
            <Typography.Paragraph size="sm" color="muted">{t.datasetFiles}</Typography.Paragraph>
          </div>
          <Separator />
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {t.sources.map((item) => <li key={item}><Typography.Paragraph size="sm">{item}</Typography.Paragraph></li>)}
          </ul>
        </Card.Content>
      </Card>

      <section id="contact" aria-labelledby="contact-title" className="flex flex-col gap-3">
        <Typography.Heading id="contact-title" level={3}>{t.contactTitle}</Typography.Heading>
        <Typography.Paragraph>
          {t.contactLead}{" "}
          <Link href={issuesUrl} target="_blank" rel="noopener noreferrer">{t.contactLink}</Link>
        </Typography.Paragraph>
      </section>
    </div>
  );
}
