import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as Lambda from 'aws-cdk-lib/aws-lambda';
import * as S3 from 'aws-cdk-lib/aws-s3';

export class SharedMediaStack extends cdk.Stack {
  public readonly thumbnailerFunctionArn: string;
  public readonly thumbnailerRoleArn: string;
  public readonly htmlToPDFFunctionArn: string;
  public readonly htmlToPDFFunctionRoleArn: string;
  public readonly htmlToPDFViaS3BucketFunctionArn: string;
  public readonly htmlToPDFViaS3BucketFunctionRoleArn: string;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const s3BucketIDEALambdaFn = S3.Bucket.fromBucketName(
      this,
      'IDEALambdaFunctions',
      `idea-lambda-functions${cdk.Stack.of(this).region === 'eu-south-1' ? '' : `-${cdk.Stack.of(this).region}`}`
    );

    const thumbnailer = createThumbnailer(this, s3BucketIDEALambdaFn);
    this.thumbnailerFunctionArn = thumbnailer.alias.functionArn;
    this.thumbnailerRoleArn = thumbnailer.roleArn;
    const html2pdfAliases = createHTMLToPDFLambdaFunctions(this, s3BucketIDEALambdaFn);
    this.htmlToPDFFunctionArn = html2pdfAliases[0].alias.functionArn;
    this.htmlToPDFFunctionRoleArn = html2pdfAliases[0].roleArn;
    this.htmlToPDFViaS3BucketFunctionArn = html2pdfAliases[1].alias.functionArn;
    this.htmlToPDFViaS3BucketFunctionRoleArn = html2pdfAliases[1].roleArn;
  }
}

const createThumbnailer = (
  scope: Construct,
  s3BucketIDEALambdaFn: S3.Bucket | cdk.aws_s3.IBucket
): { alias: Lambda.Alias; roleArn: string } => {
  const ghostScriptLayer = new Lambda.LayerVersion(scope, 'GhostScriptLayer', {
    description: 'To convert images',
    layerVersionName: 'idea_ghost_script',
    code: Lambda.Code.fromBucket(s3BucketIDEALambdaFn, 'layer-ghost-script.zip')
  });

  const imageMagickLayer = new Lambda.LayerVersion(scope, 'ImageMagickLayer', {
    description: 'To convert images',
    layerVersionName: 'idea_image_magick',
    code: Lambda.Code.fromBucket(s3BucketIDEALambdaFn, 'layer-image-magick.zip')
  });

  const THUMBNAILER_KEY = 'ThumbnailerFn';
  const thumbnailerFn = new Lambda.Function(scope, THUMBNAILER_KEY, {
    description: 'Convert an S3 uploaded media into a thumbnail',
    architecture: Lambda.Architecture.X86_64,
    runtime: Lambda.Runtime.NODEJS_18_X,
    memorySize: 1536,
    timeout: Duration.seconds(10),
    code: Lambda.Code.fromBucket(s3BucketIDEALambdaFn, 'fn-thumbnailer.zip'),
    handler: 'index.handler',
    functionName: 'idea_thumbnailer',
    environment: {
      THUMB_KEY_PREFIX: 'thumbnails/',
      THUMB_HEIGHT: '600',
      THUMB_WIDTH: '600'
    },
    layers: [ghostScriptLayer, imageMagickLayer],
    logRetention: RetentionDays.TWO_WEEKS
  });
  const thumbnailerFnProdVersion = new Lambda.Version(scope, THUMBNAILER_KEY.concat('ProdVersion'), {
    lambda: thumbnailerFn,
    description: 'Production version'
  });
  const thumbnailerFnProdAlias = new Lambda.Alias(scope, THUMBNAILER_KEY.concat('ProdAlias'), {
    version: thumbnailerFnProdVersion,
    aliasName: 'prod',
    description: 'Production alias'
  });

  return { alias: thumbnailerFnProdAlias, roleArn: getFunctionRoleArn(thumbnailerFn) };
};

const createHTMLToPDFLambdaFunctions = (
  scope: Construct,
  s3BucketIDEALambdaFn: S3.Bucket | cdk.aws_s3.IBucket
): { alias: Lambda.Alias; roleArn: string }[] => {
  const chromiumPuppetteerLayer = new Lambda.LayerVersion(scope, 'ChromiumPuppetteerLayer', {
    description: 'Chromium and Puppetteer',
    layerVersionName: 'idea_chromium_puppetter',
    code: Lambda.Code.fromBucket(s3BucketIDEALambdaFn, 'layer-chromium-puppetteer.zip')
  });

  const lambdaFnOptions = {
    architecture: Lambda.Architecture.X86_64,
    runtime: Lambda.Runtime.NODEJS_18_X,
    memorySize: 1536,
    timeout: Duration.seconds(20),
    handler: 'index.handler',
    layers: [chromiumPuppetteerLayer],
    logRetention: RetentionDays.TWO_WEEKS
  };

  const HTML_TO_PDF_KEY = 'HTMLToPDFFn';
  const htmlToPDFFn = new Lambda.Function(scope, HTML_TO_PDF_KEY, {
    ...lambdaFnOptions,
    description: 'Create a PDF from an HTML source',
    functionName: 'idea_html2pdf',
    code: Lambda.Code.fromBucket(s3BucketIDEALambdaFn, 'fn-html2pdf.zip')
  });
  const htmlToPDFFunctionProdVersion = new Lambda.Version(scope, HTML_TO_PDF_KEY.concat('ProdVersion'), {
    lambda: htmlToPDFFn,
    description: 'Production version'
  });
  const htmlToPDFFunctionProdAlias = new Lambda.Alias(scope, HTML_TO_PDF_KEY.concat('ProdAlias'), {
    version: htmlToPDFFunctionProdVersion,
    aliasName: 'prod',
    description: 'Production alias'
  });

  const HTML_TO_PDF_VIA_S3_KEY = 'HTMLToPDFViaS3Fn';
  const htmlToPDFFViaS3BFn = new Lambda.Function(scope, HTML_TO_PDF_VIA_S3_KEY, {
    ...lambdaFnOptions,
    description: 'Create a PDF from an HTML source and offer the result via S3 bucket',
    functionName: 'idea_html2pdf_viaS3Bucket',
    code: Lambda.Code.fromBucket(s3BucketIDEALambdaFn, 'fn-html2pdf_viaS3Bucket.zip')
  });
  const htmlToPDFFViaS3BFnProdVersion = new Lambda.Version(scope, HTML_TO_PDF_VIA_S3_KEY.concat('ProdVersion'), {
    lambda: htmlToPDFFViaS3BFn,
    description: 'Production version'
  });
  const htmlToPDFFViaS3BFnProdAlias = new Lambda.Alias(scope, HTML_TO_PDF_VIA_S3_KEY.concat('ProdAlias'), {
    version: htmlToPDFFViaS3BFnProdVersion,
    aliasName: 'prod',
    description: 'Production alias'
  });

  return [
    { alias: htmlToPDFFunctionProdAlias, roleArn: getFunctionRoleArn(htmlToPDFFn) },
    { alias: htmlToPDFFViaS3BFnProdAlias, roleArn: getFunctionRoleArn(htmlToPDFFViaS3BFn) }
  ];
};

const getFunctionRoleArn = (fn: Lambda.Function): string => {
  if (!fn.role?.roleArn) {
    throw new Error(`Missing Lambda role for function ${fn.functionName}`);
  }
  return fn.role.roleArn;
};
